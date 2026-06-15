# BeetleX Backend Assignment

A backend service built with TypeScript, Express, and Prisma.

## Getting Started

1. Copy `.env.example` to `.env` and configure your environment variables.
2. Start the database service:
   ```bash
   docker-compose up -d
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

Refer to [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) for architectural and directory details.
