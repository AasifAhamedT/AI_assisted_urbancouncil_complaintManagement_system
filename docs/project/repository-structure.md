# Repository Structure

## Monorepo model

The repository keeps the web client, public API, Python AI services, database assets, documentation, and future deployment configuration in one versioned workspace. npm workspaces will manage the TypeScript packages. Python services keep independent virtual environments and dependency manifests because they have different runtime dependencies.

## Folder ownership

### `apps/web`

The React/Vite client. It will contain pages, reusable components, hooks, API clients, actor-aware routes, types, and frontend tests. It must not contain database access or provider secrets.

### `apps/api`

The only public application API. It will contain authentication, department, complaint, notification, GIS, reporting, AI-adapter, and RAG-adapter modules. Backend authorization is enforced here even when the frontend hides an action.

### `services/ai-classifier`

The FastAPI service for structured category recommendations. It accepts a backend-provided allow-list and never assigns departments.

### `services/rag`

The FastAPI service for authorized document ingestion, embeddings, retrieval, grounded generation, citations, and abstention.

### `packages/shared-types`

Framework-neutral TypeScript contracts that are truly shared between the web application and API. Domain logic must not be placed here merely to avoid choosing an owner.

### `database`

Versioned MySQL migration scripts and read-only verification queries. Database credentials, dumps containing real data, and ad-hoc destructive scripts must not be committed.

### `docs`

Requirements, architecture, database design, decisions, test evidence, and operating guidance. Documentation must distinguish proposed behavior from verified implementation.

### `infra`

Reserved for Docker and deployment assets during Phase 19. It is not a place for secrets or developer-specific configuration.

### `postman`

The versioned `Smart Urban Council API Tests` collection and safe environment template will be added as endpoints are implemented.

## Dependency direction

```text
apps/web -> apps/api -> owned backend modules/databases
                      -> services/ai-classifier
                      -> services/rag

services/rag -> ChromaDB and Gemini
services/ai-classifier -> Gemini
```

The frontend does not call MySQL, ChromaDB, or Gemini directly. Python services do not query private complaint tables.

