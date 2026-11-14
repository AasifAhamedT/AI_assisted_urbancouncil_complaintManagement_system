# Smart Urban Council Complaint Management System

An AI-assisted GIS-based platform proposed for smart citizen services and digital governance in the Kinniya Urban Council context.

> This is an undergraduate software engineering project. It is not claimed to be officially approved, deployed, or adopted by Kinniya Urban Council. Unconfirmed organizational information is marked `[NEEDS CONFIRMATION]`.

## Project goals

- Let Citizens submit and track complaints with attachments and map locations.
- Recommend complaint categories using a validated Gemini integration.
- Route complaints through configurable category-to-department mappings.
- Enforce strict backend isolation between Department Accounts.
- Support controlled status changes, processing history, and reassignment approval.
- Provide authorized GIS maps, notifications, dashboards, and reports.
- Answer documented citizen questions through a source-grounded RAG chatbot.

## Primary actors

1. **Citizen** — submits and tracks only their own complaints.
2. **Department Account** — processes only complaints assigned to its department.
3. **Administrator** — manages configuration and monitors the system.

## Planned technology stack

- React, Vite, TypeScript, Tailwind CSS, React Router, and React Leaflet
- Node.js, Express, TypeScript, REST, JWT authentication, and schema validation
- Python, FastAPI, Pydantic, Gemini, and ChromaDB
- MySQL 8.0 with six logical databases
- Vitest/Jest, Pytest, Postman, Docker, and Docker Compose

## Repository layout

```text
apps/
  api/                  Node.js/Express public API and business modules
  web/                  React/Vite web application
services/
  ai-classifier/        Python/FastAPI complaint classification service
  rag/                  Python/FastAPI document-grounded chatbot service
packages/
  shared-types/         Framework-neutral TypeScript contracts where justified
database/
  migrations/           Ordered MySQL migrations
  verification/         Read-only schema verification queries
docs/
  architecture/         Architecture decisions and PlantUML diagrams
  database/             Database design documentation
  requirements/         Requirements and traceability
  project/              Repository and phase documentation
infra/                  Deployment assets added in the infrastructure phase
postman/                API collection and environment templates
```

See [Repository Structure](docs/project/repository-structure.md) for ownership and folder rules.

## Current status

- Phase 0: environment inspection completed.
- Phase 1: requirements baseline approved.
- Phase 2: architecture baseline approved.
- Phase 3: migrations executed successfully by the project owner; exact verification evidence and the database ER diagram are deferred.
- Phase 4: repository structure initialized; initial Git commit remains pending project-owner review.

No application feature is implemented yet.

## Database

The development MySQL Server hosts:

- `auth_db`
- `complaint_db`
- `department_db`
- `notification_db`
- `gis_db`
- `reporting_db`

Migrations are in [`database/migrations`](database/migrations). Never place database credentials in migration files.

## Documentation

- [Software Requirements Specification](docs/requirements/software-requirements-specification.md)
- [Requirements Traceability Matrix](docs/requirements/requirements-traceability-matrix.md)
- [System Architecture](docs/architecture/system-architecture.md)
- [Database Design](docs/database/database-design.md)
- [Phase Status](docs/project/phase-status.md)

## Development setup

Environment files and application setup commands will be added during Phase 5. Do not run `npm install` or create Python environments based only on this Phase 4 skeleton.

## Security

- Never commit `.env` files or credentials.
- Department isolation must be enforced in backend policies and database query scopes.
- AI output is advisory and must be validated.
- The backend—not Gemini—selects departments from configured mappings.
- Report suspected credential exposure immediately and rotate the affected secret.

## License

No license has been selected. `[NEEDS CONFIRMATION]`

