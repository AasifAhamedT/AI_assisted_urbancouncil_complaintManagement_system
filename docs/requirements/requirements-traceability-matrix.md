# Requirements Traceability Matrix

**Status:** Initial Phase 1 baseline. Design components and test-case identifiers will be expanded in later phases.

| Requirement group | Primary actor/component | Planned verification | Planned phase |
|---|---|---|---|
| FR-AUTH-001–008 | Auth module; all actors | Unit, API integration, authorization, and Postman tests | 6, 18 |
| FR-CONF-001–007 | Department module; Administrator | API integration, role-denial, mapping, and audit tests | 7, 18 |
| FR-CMP-001–010 | Complaint module; Citizen | Validation, ownership, persistence, upload, pagination, and AI-failure tests | 8, 18 |
| FR-WRK-001–008 | Complaint workflow; Department/Administrator | Transition, history, internal-note, intervention, and isolation tests | 8, 14, 18 |
| FR-AI-001–007 | AI service; Complaint module; Administrator | Schema, category allow-list, timeout, fallback, storage, and override tests | 12, 18 |
| FR-RAS-001–006 | Complaint module; Department/Administrator | Ownership, mandatory reason, approval, rejection, and history tests | 14, 18 |
| FR-GIS-001–005 | GIS module; all actors | Coordinate validation, map, ownership, and department-scope API tests | 11, 18 |
| FR-NOT-001–003 | Notification module | Event, recipient isolation, read state, and failure tests | 15, 18 |
| FR-RAG-001–007 | RAG service; Administrator/Citizen | Ingestion, retrieval, citation, abstention, version, and privacy evaluation | 16, 18 |
| FR-REP-001–005 | Reporting module; Department/Administrator | Metric correctness, filter, time-period, and isolation tests | 17, 18 |
| NFR-SEC-001–010 | All backend components | Security review, static checks, secret scan, negative authorization tests | All, 18 |
| NFR-REL-001–005 | API and data layers | Failure injection, transaction, error-contract, idempotency, migration tests | 8–19 |
| NFR-PERF-001–004 | API, database, AI/RAG | Query review, pagination tests, timing measurement, async-state tests | 8–19 |
| NFR-MNT-001–006 | Entire repository | Type checks, linting, architecture review, ADR review, test coverage | 4–20 |
| NFR-UX-001–004 | Frontend | Responsive, keyboard, label, feedback, and language review | 10, 18 |
| NFR-OPS-001–004 | All services/infrastructure | Health, log, config validation, backup and recovery documentation review | 5, 18–20 |

## Critical security traceability scenarios

| Scenario | Requirements covered | Expected result |
|---|---|---|
| Citizen A requests Citizen B's complaint by identifier | FR-AUTH-008, FR-CMP-007, NFR-SEC-010 | Request denied without disclosing complaint details. |
| Department A requests Department B's complaint | FR-WRK-001, FR-WRK-002, NFR-SEC-010 | Request denied by backend authorization. |
| Department A attempts to update Department B's complaint | FR-WRK-002, NFR-SEC-010 | Mutation denied and no data changed. |
| Department supplies another department ID in a request | FR-WRK-002 | Authenticated department identity overrides/untrusts client scope. |
| Citizen attempts to register as Administrator | FR-AUTH-007, US-001 | Request rejected or role ignored safely; no privileged account created. |
| Department attempts to change routing | FR-CONF-004 | Request denied. |
| AI returns an invented category | FR-AI-003, FR-AI-004 | Recommendation rejected; complaint enters manual review. |
| AI service is unavailable during submission | FR-CMP-006, NFR-REL-001 | Complaint remains saved once and enters safe fallback processing. |
| Department requests reassignment with no reason | FR-RAS-002 | Validation error; assignment remains unchanged. |
| Department views GIS/reporting endpoints for another department | FR-GIS-004, FR-GIS-005, FR-REP-002 | Request denied or data strictly scoped to authenticated department. |

## Traceability maintenance rule

Every implemented endpoint and significant test shall reference at least one requirement identifier. A requirement is not considered verified until its test has been executed and the result recorded; implementation alone is not verification.
