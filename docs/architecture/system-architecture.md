# System Architecture

## Smart Urban Council Complaint Management System

**Phase:** 2 — System Architecture and Diagrams  
**Status:** Draft for project-owner approval  
**Requirements baseline:** Phase 1 approved  

## 1. Architectural approach

The system will use a modular service-oriented monorepo. The React frontend communicates with one public Node.js/Express API. Internally, the Node.js application is divided into modules with explicit responsibilities and data ownership. AI classification and RAG remain independent Python/FastAPI services because they have distinct dependencies, scaling behavior, and failure modes.

This approach provides service boundaries without requiring the operational complexity of deploying every business module as an independent microservice at the beginning. The internal contracts can later become network APIs if scale or organizational needs justify that change.

## 2. Main architectural decisions

### 2.1 One public API boundary

The frontend calls the Node.js API only. It does not connect directly to MySQL, ChromaDB, Gemini, or internal Python services. This centralizes authentication, authorization, validation, rate limiting, and consistent error responses.

### 2.2 Modular Node.js backend

The API contains the following modules:

- Authentication and authorization
- Department and category configuration
- Complaint management and workflow
- Notification management
- GIS
- Reporting
- AI integration adapter
- RAG integration adapter

Modules expose service interfaces and may read or write only data they own. Cross-module operations use explicit interfaces rather than direct access to another module's tables.

### 2.3 Independent AI services

The AI Classification Service accepts complaint text and the backend-supplied active category allow-list. It returns structured, validated recommendations. It never determines department assignment.

The RAG Service owns document extraction, chunking, embedding, retrieval, grounded answer generation, and source references. It uses ChromaDB and does not query private complaint records.

### 2.4 Logical database ownership

One MySQL Server will host six logical databases. Each module owns its database and no cross-database foreign keys are planned. Cross-service identifiers are stored as opaque identifiers and validated through service interfaces where necessary.

### 2.5 Synchronous-first integration

The initial system uses REST and in-process service calls. Internal domain events will trigger notifications and reporting updates without introducing a message broker. Operations that must succeed together within one owned database use transactions. Cross-owner side effects use retryable handlers and observable failure states.

## 3. Technology allocation

| Layer | Technology | Responsibility |
|---|---|---|
| Web client | React, Vite, TypeScript, Tailwind CSS | Actor-specific interfaces, maps, charts, forms |
| Public API | Node.js, Express, TypeScript | REST API, authentication, authorization, business modules |
| Validation | Schema library selected during implementation | Request, configuration, and service-contract validation |
| Relational storage | MySQL 8.0 | Transactional application data across six logical databases |
| AI classification | Python, FastAPI, Pydantic, Gemini | Structured category recommendation |
| RAG | Python, FastAPI, Pydantic, Gemini, ChromaDB | Authorized-document retrieval and grounded answers |
| GIS presentation | OpenStreetMap, React Leaflet | Location selection and authorized map display |
| Testing | Vitest/Jest as appropriate, Pytest, Postman | Unit, integration, authorization, and API verification |
| Deployment | Docker and Docker Compose, later phase | Reproducible local and deployment environments |

## 4. Security architecture

1. The API authenticates a user and constructs a trusted request principal containing user ID, role, account state, and department ID when applicable.
2. Route-level role checks reject actors that cannot perform the requested operation.
3. Resource-level policies verify citizen ownership or current department assignment.
4. Repository queries include the authorized scope; frontend filtering is never considered a security control.
5. The API sends only necessary data to AI providers.
6. File metadata and storage access are authorized through the complaint ownership policy.
7. Administrative overrides, assignment changes, and workflow transitions are auditable.
8. Refresh tokens are stored in revocable form and rotated according to the authentication design finalized in Phase 6.

## 5. Reliability and failure behavior

- A complaint is durably created before AI classification is treated as complete.
- AI timeouts, invalid output, or unavailable mappings cause an administrator-review state, not data loss.
- Notification failure does not roll back an otherwise valid complaint state change; it is recorded for retry or investigation.
- RAG failure affects chatbot availability only, not complaint management.
- Reporting may use derived snapshots later, but operational data remains the source of truth.
- Service health endpoints distinguish application readiness from external dependency availability.

## 6. Diagram guide

The PlantUML source files in the `diagrams` directory are the architecture baseline.

| Diagram | Purpose |
|---|---|
| `01-system-context.puml` | Shows actors and external systems around the platform. |
| `02-component-diagram.puml` | Shows frontend, backend modules, Python services, and owned stores. |
| `03-deployment-diagram.puml` | Shows the planned container/deployment topology. |
| `04-use-case-diagram.puml` | Maps the three actors to major system capabilities. |
| `05-complaint-activity.puml` | Describes end-to-end complaint submission and routing. |
| `06-complaint-sequence.puml` | Describes service interaction during submission. |
| `07-database-ownership.puml` | Defines logical database ownership and prohibited coupling. |
| `08-ai-classification-workflow.puml` | Shows validation, fallback, mapping, and human review. |
| `09-rag-architecture.puml` | Shows ingestion and query paths for authorized documents. |
| `10-gis-data-flow.puml` | Shows location capture, storage, and authorized retrieval. |
| `11-auth-authorization-flow.puml` | Shows authentication and resource-level authorization. |
| `12-status-workflow.puml` | Defines permitted complaint status transitions. |
| `13-reassignment-sequence.puml` | Shows the separate reassignment approval lifecycle. |

## 7. Architectural constraints

- Exactly three primary actor types remain in scope.
- Categories and mappings remain database-configurable.
- AI output is advisory and schema-validated.
- Backend mapping, not Gemini, determines a department.
- Department isolation is enforced at every relevant backend query and policy boundary.
- ChromaDB stores document embeddings, not operational complaint records.
- The reporting database contains derived data only when a demonstrated query or performance need justifies it.
- Official Council workflow, retention, SLA, and department-responsibility details remain `[NEEDS CONFIRMATION]`.

## 8. Alternatives considered

### Fully independent microservices

Rejected for the initial build because separate deployment, discovery, authentication propagation, distributed transactions, and observability would add substantial complexity without demonstrated scale requirements.

### Single monolithic database

Rejected because the approved requirements specify six logical databases and explicit ownership boundaries. A single MySQL Server still keeps local operation manageable.

### Direct frontend-to-AI integration

Rejected because it would expose provider credentials, bypass server validation, and allow category or authorization rules to be manipulated.

### AI-selected department assignment

Rejected because department routing is an accountable, configurable business rule. The model may recommend only an allowed category.

### Reassignment as complaint status

Rejected because reassignment approval and complaint processing state are separate concerns. A parallel request lifecycle preserves both facts.

## 9. Phase 2 approval checklist

- [ ] Approve the modular monorepo and single public API boundary.
- [ ] Approve Python classification and RAG as separately deployable services.
- [ ] Approve REST and internal events without a message broker initially.
- [ ] Approve the six-database ownership boundaries.
- [ ] Approve the security and failure-handling model.
- [ ] Approve the status and reassignment workflows.
- [ ] Authorize Phase 3 database design and non-destructive migration-script preparation.

