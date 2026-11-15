# Smart Urban Council Complaint Management System

An AI-assisted GIS-based platform proposed for smart citizen services and digital governance in the Kinniya Urban Council context.

> This undergraduate project is not claimed to be officially approved, deployed, or adopted by Kinniya Urban Council. Unconfirmed organizational information is marked `[NEEDS CONFIRMATION]`.

## Goals

- Citizen complaint submission and tracking with evidence and map locations.
- Validated Gemini category recommendations and configurable department routing.
- Strict backend isolation between Department Accounts.
- Controlled status history and reassignment approval.
- GIS maps, notifications, reporting, and a source-grounded RAG chatbot.

## Primary actors

1. Citizen
2. Department Account
3. Administrator

## Repository layout

```text
apps/api/               Node.js and Express public API
apps/web/               React and Vite web application
services/ai-classifier/ Python and FastAPI classification service
services/rag/           Python and FastAPI RAG service
packages/shared-types/  Shared TypeScript contracts
database/               Migrations and verification queries
docs/                   Requirements, architecture, database, and project docs
infra/                  Future Docker/deployment assets
postman/                Future API collection and environment templates
```

## Current status

- Phases 0–2: inspected, documented, and approved.
- Phase 3: database migrations executed without reported red errors; exact row evidence and ER diagram remain deferred.
- Phase 4: repository structure initialized; initial commit remains pending.
- Phases 5–7: environment, authentication, and department management implemented and verified.
- Phase 8: complaint management implemented and verified.
- Phase 9: API gateway and internal service integration implemented and verified.
- Phase 10: responsive three-role frontend implemented and verified.
- Phase 11: GIS location storage, map selection, authorized markers, nearby search, and bounds filtering implemented and verified.
- Phase 12: Gemini classification, safe fallbacks, immutable recommendations, Administrator review/override, and mapping-controlled routing implemented and verified.

## Setup

Follow the [Development Environment Setup](docs/project/environment-setup.md). Real `.env` files are local-only and must never be committed.

## Core documentation

- [Software Requirements Specification](docs/requirements/software-requirements-specification.md)
- [System Architecture](docs/architecture/system-architecture.md)
- [Database Design](docs/database/database-design.md)
- [Repository Structure](docs/project/repository-structure.md)
- [Phase Status](docs/project/phase-status.md)
- [Authentication API](docs/api/authentication-api.md)
- [Department Management API](docs/api/department-management-api.md)
- [Complaint Management API](docs/api/complaint-management-api.md)
- [API Gateway and Service Integration](docs/api/api-gateway-integration.md)
- [Frontend Application](docs/api/frontend-application.md)
- [GIS API](docs/api/gis-api.md)
- [AI Classification API](docs/api/ai-classification-api.md)
- [AI Classification Design](docs/ai/classification-design.md)

## Security rules

- Never commit secrets or real `.env` files.
- Enforce Citizen ownership and Department isolation on the backend.
- Treat AI output as advisory and validate it.
- The backend selects departments through configured mappings.

## License

No license has been selected. `[NEEDS CONFIRMATION]`

