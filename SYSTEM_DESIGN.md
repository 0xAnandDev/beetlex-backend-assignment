# System Design

## Architecture

This project is built using a modular monolithic architecture. Each domain/feature is grouped inside a module in `src/modules`.

### Directory Layout

- `prisma/`: Database schema definitions and migrations.
- `src/`: Application source code.
  - `config/`: Application configuration and environment variables definition.
  - `modules/`: Feature-specific modules (Auth, Users, Events, Teams, Registrations, Projects, Judges, Scores, Announcements).
  - `middleware/`: Express middlewares (Auth, Error handling, Logging, Validation, etc.).
  - `services/`: Global services (e.g., mailer, logging, third-party integrations).
  - `utils/`: Common utilities and helper functions.
  - `plugins/`: Custom plugin registrations.
  - `app.ts`: Express application bootstrap and server entry point.
- `tests/`: Automated tests suite.
- `docs/`: API and developer documentation.
