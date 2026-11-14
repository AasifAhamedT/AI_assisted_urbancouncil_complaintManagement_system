# Project Development Instructions

These instructions apply to the entire repository unless a more specific `AGENTS.md` exists in a subdirectory.

## Development workflow

1. Inspect existing files, dependencies, configuration, and tests before modifying code.
2. Preserve existing working behavior and unrelated user changes.
3. Follow the approved requirements, architecture, database ownership model, and current development phase.
4. Explain major implementation work, affected files, manual steps, and verification strategy before proceeding.
5. Do not execute destructive filesystem, Git, or database operations without explicit approval.
6. Do not claim that code, migrations, tests, APIs, or deployments work unless they were actually verified.
7. Record significant architectural decisions and keep documentation synchronized with implementation.

## Technology and code quality

1. Use TypeScript for React and Node.js code with strict type checking.
2. Use Python type hints and Pydantic models in FastAPI services.
3. Use REST contracts for communication between separately deployable services.
4. Keep HTTP controllers thin; place business rules in dedicated service/domain components.
5. Introduce design patterns only when they solve a demonstrated problem.
6. Validate all backend input with explicit schemas.
7. Use consistent, structured error responses without leaking sensitive implementation details.
8. Write automated tests for important business logic, authorization, and failure handling.

## Security and privacy

1. Never commit secrets, passwords, access tokens, refresh tokens, private keys, or provider credentials.
2. Use environment variables and commit only safe `.env.example` templates.
3. Enforce authentication and authorization on the backend.
4. Enforce Citizen ownership and Department-level data isolation in backend policies and scoped queries.
5. Never rely on frontend filtering as a security control.
6. Treat identifiers supplied by clients as untrusted input.
7. Store only password hashes and refresh-token hashes, never raw credentials.
8. Validate file size, type, extension, and generated storage names.
9. Avoid logging credentials, tokens, private complaint content, or unnecessary personal data.

## Data and service boundaries

1. Respect logical database ownership: Auth, Complaint, Department, Notification, GIS, and Reporting.
2. Do not introduce cross-database foreign keys or direct cross-owner writes.
3. Use service interfaces or REST APIs for cross-owner communication.
4. Keep categories, departments, and routing mappings configurable; do not hardcode them in business logic.
5. Gemini may recommend only a backend-supplied active category.
6. The backend determines department assignment using the configured mapping.
7. Preserve original AI recommendations separately from final human-approved decisions.
8. Core complaint submission must remain durable when AI or RAG services fail.

## Domain constraints

1. The only primary actors are Citizen, Department Account, and Administrator unless the project owner approves a change.
2. A Department Account represents a department, not an individual officer.
3. Reassignment is a separate approval lifecycle, not a complaint status.
4. Status transitions must use the centralized approved transition policy and generate history.
5. Mark unconfirmed Council procedures, responsibilities, policies, boundaries, and mappings as `[NEEDS CONFIRMATION]`.
6. Do not claim that the system is officially approved, adopted, or deployed by Kinniya Urban Council.

## Manual operations

1. Clearly label manual actions involving MySQL Workbench, API keys, Postman, GitHub, or deployment.
2. Explain database objects and provide verification steps before asking the project owner to execute SQL.
3. Never run destructive database statements without explicit approval.
4. For important APIs, document method, URL, headers, authentication, request body, expected response, and negative cases.

