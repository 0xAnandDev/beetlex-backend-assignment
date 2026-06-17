# BeetleX Hackathon Platform — Backend API

This repository contains the backend implementation for the BeetleX Hackathon Platform, built using **Fastify**, **TypeScript**, **PostgreSQL**, **Prisma ORM**, **Zod**, and **Docker**.

The platform enables organizers to manage events, participants to form teams, submit projects, and upload pitch decks, judges to evaluate submissions, and displays a real-time, targeted leaderboard and announcements delivery system.

---

## 1. Project Overview & Features

### Core Implemented Modules
* **Authentication**: JWT access token validation paired with secure HttpOnly, secure, path-restricted Refresh Token rotation and active session invalidation (logout).
* **Events**: Automated slug generation, pagination, and role-based event lifecycle controls (draft, open, active, judging, closed).
* **Registrations**: Slot capacity bounds, registration deadline windows, and soft-cancellation tracking.
* **Teams**: Direct link-based team membership (`Registration.teamId`) avoiding synchronization discrepancies, leader designation, and automated leadership handoff.
* **Projects & Submissions**: Submissions locked to event deadlines. Supports pitch deck upload simulations (.pdf only) and enforces a limit of one project per team.
* **Judging & Scoring**: Assignment check to ensure only assigned judges evaluate projects, score boundaries (1-10) per criteria, and average score metrics.
* **Announcements**: Draft-to-published workflow, target visibility filtering strictly resolved at the query level (`all`, `participants`, `judges`, `organizers`), and idempotent read tracking.
* **Leaderboard**: Deterministic rank orderings calculated dynamically from judge score averages with an automatic tie-breaker (earlier `submittedAt` wins).

---

## 2. Technology Stack

- **Framework**: Fastify
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma ORM
- **Validation**: Zod
- **Authentication**: JWT (Access Tokens) & HTTP-Only Cookies (Refresh Tokens)
- **Deployment**: Docker & Docker Compose

---

## 3. Architecture Overview

### Project Directory Structure
```
src/
├── app.ts                         # Application entrypoint & plugin boots
├── config/
│   └── prisma.ts                  # Shared Prisma client instantiation
├── middleware/
│   ├── auth.middleware.ts         # JWT authentication verify hook
│   ├── error.middleware.ts        # Fastify global error handler
│   ├── role.middleware.ts         # RBAC helper using UserRole enums
│   └── validate.middleware.ts     # Zod schema input validator hook
├── modules/
│   ├── announcements/             # Broadcasts & read tracking
│   ├── auth/                      # Registration, login, & session rotation
│   ├── events/                    # Hackathon event management
│   ├── judges/                    # Event judge assignments
│   ├── judging/                   # Scoring & evaluations
│   ├── leaderboard/               # Dynamic ranked standings
│   ├── projects/                  # Submission & deck mock uploads
│   ├── registrations/             # Event participant registration
│   ├── teams/                     # Team creation & joining
│   └── users/                     # User metadata management
└── utils/
    ├── errors.ts                  # AppError class definition
    ├── hash.ts                    # BCrypt password helpers
    ├── response.ts                # Unified JSON success responses
    └── slug.ts                    # Slugging helpers for events
```

### Layer Responsibilities
* **Routing (`*.routes.ts`)**: Registers Fastify endpoints, binding input validators and auth hooks to the pre-handler chain.
* **Controller (`*.controller.ts`)**: Decouples network layers. Extracts path, query, and body params, forwards them to the service layer, and wraps outputs in the standard `successResponse` envelope.
* **Service (`*.service.ts`)**: Holds 100% of the business logic. Runs database validations, checks permissions, handles transactions, and executes domain computations.
* **Validation (`*.validation.ts`)**: Declares Zod schemas to sanitize and validate route variables, payloads, and query parameters before reaching logic pools.

---

## 4. Setup & Run Instructions

### Prerequisites
* **Docker** and **Docker Compose** installed.

### Primary Setup (Docker Compose)
The entire stack is configured to build and spin up automatically with a single command. 
1. Copy the example environment template:
   ```bash
   cp .env.example .env
   ```
2. Run the compose script:
   ```bash
   docker-compose up --build
   ```
This command will:
- Launch the PostgreSQL database container.
- Perform health-checks on PostgreSQL using `pg_isready` until it is fully ready.
- Execute all pending database migrations (`npx prisma migrate deploy`) automatically.
- Generate the Prisma Client typing libraries.
- Compile TypeScript to JavaScript and boot the Fastify API.
- Expose the API on `http://localhost:3000`.

### Local Development Setup (Secondary Option)
If you prefer running the API server directly on your host machine:
1. Start only the PostgreSQL database container:
   ```bash
   docker-compose up -d postgres
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run migrations and generate the client:
   ```bash
   npx prisma migrate dev
   ```
4. Start the development server (with hot-reloading):
   ```bash
   npm run dev
   ```

### Verification
Ensure the server is running healthy by hitting the health endpoint:
```bash
curl http://localhost:3000/health
```
**Expected Response:**
```json
{
  "success": true,
  "message": "API is healthy",
  "data": {
    "timestamp": "2026-06-17T05:27:13.573Z"
  }
}
```

---

## 5. Complete API Endpoint List

### Authentication Module (`/auth`)
* `POST /auth/register` - Creates a new user profile.
* `POST /auth/login` - Authenticates user credentials, sets refresh token cookie, and returns access token.
* `POST /auth/refresh` - Rotates expired access token using the HttpOnly refresh token.
* `POST /auth/logout` - Revokes refresh token session and clears authentication cookies.
* `GET /auth/me` - Retrieves the profile details of the currently authenticated user.
* `PATCH /auth/me` - Updates the current user's profile information.

### Events Module (`/events`)
* `POST /events` - Creates a new hackathon event (Organizers & Admins only).
* `GET /events` - Lists events with pagination, sorting, and status filters.
* `GET /events/:id` - Retrieves a detailed view of an event by its ID or slug.
* `PATCH /events/:id` - Updates event metadata (Event Organizer & Admins only).
* `DELETE /events/:id` - Deletes/closes an event (Event Organizer & Admins only).

### Registrations Module (`/events/:id/register`, `/events/:id/registration`)
* `POST /events/:id/register` - Registers the authenticated user for the event.
* `GET /events/:id/registration` - Retrieves the current user's registration status.
* `DELETE /events/:id/registration` - Cancels the user's registration (soft-delete).
* `GET /events/:id/registrations` - Lists all registrations for an event (Organizers & Admins only).

### Teams Module (`/events/:eventId/teams`)
* `POST /events/:eventId/teams` - Creates a new team with the user set as the leader.
* `POST /events/:eventId/teams/:teamId/join` - Joins an existing team.
* `DELETE /events/:eventId/teams/:teamId/leave` - Leaves the team (automatically handles leadership handoff).
* `GET /events/:eventId/teams/:teamId` - Gets team details and its current member list.
* `GET /events/:eventId/teams` - Lists all teams registered in the event.

### Projects & Submissions Module (`/teams/:teamId/project`, `/events/:eventId/projects`)
* `POST /teams/:teamId/project` - Creates a draft project submission for a team.
* `GET /teams/:teamId/project` - Gets the project details (accessible to team members/judges/organizers).
* `PATCH /teams/:teamId/project` - Edits project draft details (Team members only).
* `POST /teams/:teamId/project/submit` - Locks project from further edits and sets the submission timestamp.
* `POST /teams/:teamId/project/deck` - Simulates uploading a PDF pitch deck.
* `GET /events/:eventId/projects` - Retrieves all submitted projects for evaluation.

### Judging & Scoring Module (`/judge`, `/events/:eventId/scores`)
* `GET /judge/projects` - Lists all projects assigned to the logged-in judge.
* `GET /judge/projects/:projectId` - Gets project details along with the judge's score.
* `POST /judge/projects/:projectId/score` - Submits scores (1-10) for innovation, technical, impact, and presentation.
* `PATCH /judge/projects/:projectId/score` - Updates scores (blocked once the event is closed).
* `GET /events/:eventId/scores` - Gets a breakdown of all scores across projects (Organizers & Admins only).

### Announcements Module (`/events/:eventId/announcements`)
* `POST /events/:eventId/announcements` - Creates a draft announcement (Organizers & Admins only).
* `POST /events/:eventId/announcements/:annId/publish` - Publishes an announcement and sets `publishedAt` (Organizers & Admins only).
* `GET /events/:eventId/announcements` - Lists published announcements matching the user's targeted role.
* `POST /events/:eventId/announcements/:annId/read` - Marks an announcement as read (idempotent).
* `GET /events/:eventId/announcements/unread-count` - Returns the count of unread announcements visible to the user.

### Leaderboard Module (`/events/:eventId/leaderboard`)
* `GET /events/:eventId/leaderboard` - Retrieves ranked leaderboard standings (Organizers/Admins can access anytime; others can only access if the event status is `closed`).

---

## 6. Database Schema & Entities

### Database Relationships
- **User → Registration** (One-to-Many)
- **Event → Registration** (One-to-Many)
- **Event → Team** (One-to-Many)
- **Team → Project** (One-to-One)
- **Project → Score** (One-to-Many)
- **User → Score** (One-to-Many)
- **User → RefreshToken** (One-to-Many)
- **Announcement → AnnouncementRead** (One-to-Many)
- **User → AnnouncementRead** (One-to-Many)
- **Event → EventJudge** (One-to-Many)
- **User (Judge) → EventJudge** (One-to-Many)

### Core Entities & Relationships
1. **User**: Handled via `UserRole` enum (`participant`, `judge`, `organizer`, `admin`).
2. **Event**: Configured with strict datetime windows (e.g., `registrationOpen`/`Close`, `eventStart`/`End`, and `submissionDeadline`).
3. **Registration**: Joins `User` to `Event`. Acts as the single source of truth for **Team Membership** via a nullable `teamId` FK.
4. **Team**: Contains team name and links to the leader (`User`) and the event.
5. **Project**: Tied uniquely to a `Team` (`teamId`) for an `Event` (`eventId`).
6. **Score**: Tracks assessments per criterion. Unique on `(projectId, judgeId)`.
7. **Announcement**: Targeted to a specific audience via `AnnouncementTarget` (`all`, `participants`, `judges`, `organizers`).
8. **AnnouncementRead**: Tracks read events using a composite primary key: `(announcementId, userId)`.

---

## 7. Authentication & Authorization

* **JWT Strategy**: Dual-token architecture. Access tokens are passed in the `Authorization` header (`Bearer <token>`). Short expiration times (e.g., 15m) limit compromise windows.
* **Refresh Tokens**: Saved in the database and linked to the active session. The token is delivered to the client via an HTTP-only, secure, same-site cookie. It is rotated on every refresh request, and logouts revoke the token in the database to prevent reuse.
* **Role-Based Access Control (RBAC)**: Handled dynamically via the `authorize(allowedRoles: UserRole[])` pre-handler hook, ensuring route-level isolation for administrative and evaluation endpoints.

---

## 8. Design Decisions & Trade-offs

* **Why Fastify?** Fastify was chosen over Express for its built-in schema serialization (speed), native TypeScript support, modular plugin system, and structured hook lifecycle, which makes request preprocessing (`preHandler`) highly maintainable.
* **Single Source of Truth for Team Membership**: Instead of maintaining a separate `TeamMember` model alongside registration, team membership is strictly tracked using `Registration.teamId`. This prevents sync bugs, avoids table join updates on leave/join, and simplifies the codebase.
* **Soft Cancellations**: Deleting registrations makes it difficult to audit historical records and manage slot metrics. Setting status to `cancelled` preserves logs while freeing up slots cleanly.
* **Service-Layer Dynamic Leaderboard Calculation**: Ranks are computed on-read by aggregating scores in the service layer instead of relying on database generated columns. This avoids heavy SQL triggers, enables clean formatting, and handles complex sorting (like the `submittedAt` tie-breaker) dynamically in Node.js.

---

## 9. What I Would Do With More Time

While the core focus of this implementation was placed on delivering a production-ready architecture, robust Dockerized deployment, database design, API implementation, schema validation, authentication, authorization, and system design, the following engineering enhancements would be added in future iterations:
* **Extensive Automated Testing Suite**:
  - **Unit Testing**: Implement comprehensive unit tests targeting service-layer business logic (such as team membership transitions, leader assignment, and event time window checks).
  - **Integration Testing**: Add integration tests covering complete user flows including authentication session rotation, registration cancellations, and leaderboard calculation correctness.
  - **Concurrency & Race-Condition Testing**: Write tests using concurrent asynchronous execution blocks to verify database locking behaviors against race conditions on team joining operations and event registration limits.
  - **End-to-End Testing**: Set up an end-to-end testing pipeline integrated within CI/CD workflows to run automatically on pull requests.
* **Performance & Load Testing**: Execute load testing profiles targeting high-contention spikes (e.g., thousands of simultaneous requests hitting the leaderboard or flash registration openings).
* **Redis Caching**: Cache the event standings in a Redis Sorted Set (`ZSET`) to resolve reads in `O(log(N))` time and protect PostgreSQL CPU limits under scale.
* **Asynchronous Workers**: Deploy BullMQ alongside Redis to handle non-blocking asynchronous task execution (such as email dispatching and certificate generation).
* **Direct Object Storage Uploads**: Transition the pitch deck upload to a direct-to-S3 presigned URL flow to keep binary file transfer payloads completely isolated from the API server.

---

## 10. Known Limitations

* **Automated Test Coverage**: Extensive automated test suites and load testing benchmarks were intentionally left for a subsequent hardening phase, prioritizing the core architectural execution and system design.
* **Simulated Deck Uploads**: The pitch deck submission endpoint validates parameters and stores a mock file URL rather than streaming binary objects to external cloud storage.
* **In-Memory Sorting**: Leaderboard standings are compiled and sorted dynamically in the service layer. While highly efficient and appropriate for standard hackathon event scales, sorting large datasets would be delegated to PostgreSQL query logic or dedicated caching systems.

---

## 11. Submission Notes

* Spin up the entire stack with `docker-compose up --build`. No manual configuration is required.
* Database migrations deploy automatically on startup via `docker-entrypoint.sh`.
* Port `3000` exposes the API, and the `/health` endpoint is available to check readiness.
