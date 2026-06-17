# BeetleX Hackathon Platform — System Design & Architecture Q&A

This document provides detailed, technically-grounded architectural answers to the five core system design questions for the BeetleX Backend developer assignment.

---

## Q1: Real-Time Leaderboard at Scale

### 1. Aggregate Score Computation Strategy
Serving 5,000 concurrent participants reading the leaderboard while 20 judges concurrently update scores presents a classic **read-heavy, write-light** pattern. 
* **Chosen Approach: Event-Driven Pre-computation on Write (Write-Through Cache)**.
* **Why not On-Read?** Running `AVG(Score.total)` on 5,000 requests simultaneously would lead to `O(N * M)` aggregation queries, saturating PostgreSQL CPU, filling connection pools, and causing service degradation.
* **Why not Materialized Views?** PostgreSQL materialized views do not refresh incrementally out-of-the-box. Running `REFRESH MATERIALIZED VIEW` locks the table/view, introducing significant query latency during updates.
* **Write-Through Cache Mechanics:** With only 20 judges, score updates are rare (low write frequency). We compute `Score.total` and the project's `averageScore` on the application layer during a judge write transaction, then write the updated score to a **Redis Sorted Set (ZSET)** (`leaderboard:event:<eventId>`). This decouples read traffic completely from database compute resources.

### 2. Caching Strategy
* **Data Structure:** A Redis Sorted Set (`leaderboard:event:<eventId>`) where the project's `averageScore` is the score and `projectId` is the member. Project metadata (e.g., title, team name) is stored in a separate Redis Hash (`project:metadata:<eventId>`) to save memory.
* **Cache TTL:** `3600` seconds (1 hour). The cache is persistent during the active judging phase and fully updated in-place.
* **Cache Invalidation & In-Place Updates:**
  When a judge submits/updates a score:
  1. Save the score in the database within a transaction.
  2. Query the updated project's new average score from PostgreSQL.
  3. Write/update the value directly in the Redis Sorted Set using `ZADD leaderboard:event:<eventId> <new_average_score> <project_id>`.
  4. Publish a message to Redis Pub/Sub to trigger real-time client push updates. This avoids stampedes by avoiding full cache invalidations.

### 3. Critical Indexes for Leaderboard Queries
To ensure optimal performance if Redis fails and the system falls back to querying the database directly:

```sql
-- Index to filter non-draft projects quickly for a specific event
CREATE INDEX idx_projects_event_status_submitted 
ON projects (event_id, status) 
WHERE status != 'draft';

-- Composite index to optimize score aggregation lookup per project
CREATE INDEX idx_scores_project_judge 
ON scores (project_id, judge_id);

-- Partial index for fast tie-breaker resolution using project submission times
CREATE INDEX idx_projects_submitted_at 
ON projects (event_id, submitted_at) 
WHERE status != 'draft';
```

### 4. Real-Time Push Architecture
To push live ranking updates without database polling:
1. Fastify backend publishes a JSON event payload to a Redis Pub/Sub channel (`event:<eventId>:leaderboard_updates`) whenever a score is updated:
   `PUBLISH event:123:leaderboard_updates '{"projectId": "abc", "rank": 1, "averageScore": 9.2}'`
2. Horizontal Fastify API nodes maintain persistent **Server-Sent Events (SSE)** connections with connected clients via `/events/:eventId/leaderboard/live`.
3. Each node subscribes to the Redis Pub/Sub channel. Upon receiving an event, it broadcasts the payload to its local in-memory pool of connected SSE clients, achieving horizontal scalability.

---

## Q2: 50,000 Registrations in One Day

### 1. Database-Level Duplicate Prevention
PostgreSQL enforces the unique constraint `@@unique([eventId, userId])` using a unique **B-Tree Index**. Under high concurrency:
* When a insert transaction attempts to write a duplicate `(eventId, userId)`, PostgreSQL locks the corresponding index page bucket.
* If a matching key is found, the transaction is immediately aborted with error code `23505` (unique_violation).
* This guarantee remains atomic and isolated at the engine level regardless of application concurrency or network delays.

### 2. Rate Limiting Strategy
Rate limiting is implemented at two layers of the stack:
1. **Reverse Proxy (Cloudflare / Nginx):** Limits requests by IP address (e.g., max 60 requests per minute) to filter out botnets and low-level script flooding.
2. **API Middleware (Fastify + Redis):** Limits request rate by authenticated `userId` (e.g., max 5 registrations per minute) and by target `eventId` (e.g., max 100 registration requests per second overall) to prevent thread/row lock starvation inside PostgreSQL.

### 3. Queue vs. Direct Writes
* **Direct Database Writes:** 50,000 registrations over 24 hours equals an average of ~0.58 requests/second. Even a peak load of 100x average (60 requests/second) can easily be handled synchronously by PostgreSQL directly.
* **When to use a Queue (e.g., BullMQ / Redis):**
  A queue is required if the registration process involves slow, synchronous side effects (e.g., calling third-party APIs like SendGrid to send emails, generating PDF tickets, or syncing CRM tools). In this case, write the core registration data directly to the database to give the user instant feedback, and offload the side effects to background workers via a message queue.

### 4. Connection Pool & PostgreSQL Configuration
To handle high sustained write loads on a 16GB RAM database server:
* **PostgreSQL Configuration (`postgresql.conf`):**
  ```ini
  max_connections = 500
  shared_buffers = 4GB             # 25% of RAM
  work_mem = 16MB                  # Faster in-memory sorting
  maintenance_work_mem = 512MB
  effective_cache_size = 12GB      # 75% of RAM
  synchronous_commit = off         # Speeds up writes (acceptable loss of last few writes in crash)
  ```
* **Connection Pooling:** 
  Do not connect application nodes directly to PostgreSQL. Use **PgBouncer** in `transaction` mode. Configure the application database connection pool to hold a fixed size of `30-50` connections per node. PgBouncer multiplexes thousands of incoming client sockets into a tight, pre-warmed pool of active PostgreSQL server connections, avoiding connection-allocation overhead.

### 5. Response Strategy Under Saturation
When the system is overwhelmed:
* Fastify detects database pool timeout warnings and immediately returns `429 Too Many Requests` or `503 Service Unavailable` with a `Retry-After: 5` header.
* The client UI catches these headers and displays a clean, styled page stating: *"We are experiencing high registration volume. You are in queue—retrying in 5 seconds..."* rather than failing with raw stack traces.

---

## Q3: Pitch Deck Upload Pipeline

```
[Client] ---> Request Presigned URL ---> [Fastify Server]
   ^                                           |
   |                                    1. Check size/mime
   |                                    2. Return Presigned URL
   |                                           v
   +-------- Uploads 10MB PDF File -----------> [S3 Bucket]
                                               | (ObjectCreated)
                                               v
[Client Socket] <-- Scan Infected/Clean <--- [AWS Lambda (ClamAV)]
```

### 1. Upload Flow: Presigned URLs vs. Server-side Multipart
* **Chosen Approach: Direct-to-S3 Presigned URLs**.
* **Justification:** Transferring 800 PDF files of 10MB each (8GB total) in 30 minutes through the Fastify server would consume server network bandwidth, block the single-threaded Node.js event loop during buffer allocation, and trigger Out-Of-Memory (OOM) failures under concurrency. Presigned URLs delegate the network I/O, file streaming, and encryption overhead directly to AWS S3.

### 2. Multi-Layer File Validation
Validation is performed at three layers:
1. **Client-Side:** HTML5 input validation (`accept="application/pdf"`) and file object checks inside JS before calling the API.
2. **Server-Side (Pre-Upload):** Before generating the presigned URL, Fastify validates the requested `content-length` and file extension. The server configures the S3 Presigned POST Policy to explicitly restrict file size:
   `["content-length-range", 1, 10485760] -- Strict 10MB Max`
   If the client attempts to upload a larger file, S3 terminates the upload immediately.
3. **Server-Side (Post-Upload):** Once S3 signals success, a background trigger downloads only the first 4 bytes of the file in S3 to verify magic numbers (`%PDF` or `25 50 44 46` in hex), guaranteeing it is a true PDF and not a renamed executable.

### 3. Storage Allocation
* **AWS S3 / Object Storage:** The file binary is stored using a structured path: `events/{eventId}/teams/{teamId}/pitch_deck_{timestamp}.pdf`.
* **PostgreSQL Database:** Stores metadata only:
  `id` (uuid), `teamId` (FK), `s3Key` (string), `fileSize` (int), `mimeType` (string), and `uploadedAt` (timestamp).

### 4. Handling Failed / Interrupted Uploads
* **S3 Lifecycle Policy:** Configure an automated rule on the S3 bucket: `AbortIncompleteMultipartUpload` after 1 day to clean up orphan binary chunks.
* **Frontend Resiliency:** The client uses an upload client like **Tus** or **Uppy** to upload in 1MB chunks. If network connectivity drops, the client resumes uploading from the last successful chunk index instead of restarting the entire 10MB upload.

### 5. Virus and Malware Scanning
* **Non-Blocking Async Scan:** Never run scans synchronously inside the upload response path, as they introduce 3–10 seconds of latency.
* **Execution Flow:**
  1. On upload completion, S3 triggers an event notification to **AWS Lambda**.
  2. The Lambda function runs **ClamAV** (or AWS GuardDuty Malware Protection) against the target S3 object.
  3. If clean: Lambda updates the database record status to `scan_status = 'clean'`.
  4. If infected: Lambda quarantines/deletes the S3 object, sets database status to `scan_status = 'infected'`, and pushes a WebSocket alert to the team interface prompting them to upload a clean file.

---

## Q4: Announcement Delivery Under Load

### 1. Message Broker Selection
* **Chosen Broker: Redis Pub/Sub + BullMQ**.
* **Justification:** Redis Pub/Sub provides ultra-low latency (~1ms), memory-efficient pub/sub message propagation. Kafka is over-engineered for this use case, introducing high infrastructure maintenance overhead for what is essentially a volatile notification fan-out. Redis is already part of the BeetleX stack.

### 2. High-Concurrency Fan-out Architecture
1. The organizer posts the announcement via `POST /events/:eventId/announcements`.
2. The Fastify API server writes the announcement to PostgreSQL, publishes it to the Redis channel `event:announcements:<eventId>`, and returns a `201 Created` immediately (total time < 30ms).
3. Multiple Fastify app instances running SSE or WebSocket connection nodes subscribe to the Redis channel. 
4. Upon receiving the message, they loop through their local pool of active connection sockets in memory and write the payload asynchronously, keeping the event loop unblocked.

### 3. Offline Delivery Guarantees
* **Volatile Network Mitigation:** If a participant is offline during the broadcast, the websocket/SSE push fails.
* **Sync-on-Reconnect Protocol:** When a client establishes a connection (or recovers from a drop), it sends its last received announcement timestamp (or ID) as part of the handshake. The backend queries PostgreSQL for any published announcements where `publishedAt > clientLastTimestamp` and matching target role, syncing missed messages.

### 4. Storing Read State Without DB Write-Storms
Having 5,000 users simultaneously click "mark as read" causes a database write storm.
* **Solution: Buffered Write-Behind Logging**.
* **Mechanics:**
  1. When a user marks an announcement as read, the API writes the event to a Redis Set: `SADD unread_buffer:<userId> <announcementId>`. The API immediately returns `200 OK`.
  2. A cron job (running via BullMQ every 5 seconds) pops read events from Redis in batches and writes them to PostgreSQL using bulk insert statements:
     ```sql
     INSERT INTO announcement_reads (announcement_id, user_id, read_at)
     VALUES ($1, $2, NOW()), ($3, $4, NOW()) ...
     ON CONFLICT DO NOTHING;
     ```
  This reduces 5,000 database writes into a single, clean batch operation.

### 5. Priority Routing
* **Announcements Schema:** Each message contains a `priority` field (`info`, `warning`, `urgent`).
* **Routing logic:**
  * **Urgent:** Bypasses standard rate-limit queues, publishes immediately to a dedicated Redis channel, and triggers immediate browser Push notifications (via Web Push API) to ensure delivery even if the client browser tab is closed.
  * **Info:** Queued and sent silently, updating the notifications indicator badge without disrupting the user.

---

## Q5: Race Conditions in Team Operations

### 1. Locking Strategy
* **Chosen Approach: Pessimistic Locking (`SELECT ... FOR UPDATE`)**.
* **Why not Optimistic?** Optimistic locking (using a `version` count column) works well under low-contention scenarios. However, when a team has exactly 1 spot left and dozens of members try to join simultaneously, optimistic transactions will frequently fail and roll back, causing client-side retry storms. Pessimistic locking serializes the write access at the database lock level, ensuring the first request gets confirmed while subsequent requests fail instantly without transaction retries.

### 2. Atomic Database Enforcement
The join operation is wrapped in a strict PostgreSQL database transaction with a row lock:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Lock the team row to serialize concurrent joins
  await tx.$executeRaw`
    SELECT id FROM teams 
    WHERE id = ${teamId} 
    FOR UPDATE
  `;

  // 2. Count current confirmed members of the team
  const currentMembers = await tx.registration.count({
    where: { 
      teamId, 
      status: { not: "cancelled" } 
    }
  });

  // 3. Enforce constraint atomically
  const MAX_TEAM_SIZE = 4;
  if (currentMembers >= MAX_TEAM_SIZE) {
    throw new AppError("Team is full", 409, "TEAM_FULL_ERROR");
  }

  // 4. Update teamId for registration
  await tx.registration.update({
    where: { eventId_userId: { eventId, userId } },
    data: { teamId }
  });
});
```

### 3. Response to the Losing Request
* **HTTP Status:** `409 Conflict` (semantics indicating resource state conflict).
* **Error Payload:**
  ```json
  {
    "success": false,
    "code": "TEAM_FULL_ERROR",
    "message": "The team is already full. Please join or create another team."
  }
  ```

### 4. Application to Event `max_registrations` Cap
* **Same Approach, Different Lock Target:** Use the same pessimistic locking mechanism, but lock the `Event` row instead of the `Team` row.
* **SQL Flow:**
  ```sql
  SELECT max_registrations FROM events WHERE id = $1 FOR UPDATE;
  ```
  This is followed by counting confirmed registrations for that event. If the count is less than the event's `max_registrations`, the registration transaction is allowed to commit.

### 5. Automated Testing Strategy for Race Conditions
To write an integration test that reliably checks for concurrency issues:
1. Seed an event and a team that has exactly 1 open slot remaining.
2. Instantiate 5 test user authentication tokens.
3. Fire 5 parallel requests using `Promise.all()` to simulate simultaneous join requests:

```typescript
import supertest from "supertest";
import app from "../../app";

describe("Team Concurrency Join Integration Test", () => {
  it("should permit only 1 user to join when 1 slot remains under high concurrency", async () => {
    const eventId = "some-event-uuid";
    const teamId = "some-team-uuid";
    
    // 5 concurrent join requests
    const joinPromises = Array.from({ length: 5 }).map((_, index) => {
      const userToken = testTokens[index];
      return supertest(app.server)
        .post(`/events/${eventId}/teams/${teamId}/join`)
        .set("Authorization", `Bearer ${userToken}`)
        .send();
    });

    const responses = await Promise.all(joinPromises);

    // Assert that exactly one request succeeded and 4 failed
    const successResponses = responses.filter((res) => res.status === 200);
    const conflictResponses = responses.filter((res) => res.status === 409);

    expect(successResponses.length).toBe(1);
    expect(conflictResponses.length).toBe(4);
    
    conflictResponses.forEach((res) => {
      expect(res.body.code).toBe("TEAM_FULL_ERROR");
    });
  });
});
```
