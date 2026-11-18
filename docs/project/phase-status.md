# Development Phase Status

| Phase | Status | Evidence / remaining work |
|---|---|---|
| 0 — Environment inspection | Complete | Toolchain and workspace inspected. |
| 1 — Requirements | Approved | SRS and traceability matrix created. |
| 2 — Architecture | Approved | Architecture document and 13 PlantUML sources created; rendered-image QA remains deferred. |
| 3 — Database design | Substantially complete | Migrations 000–008 executed; Department Account uniqueness and classification-review ledger verified. Exact initial-migration row evidence and a complete ER diagram remain deferred by project-owner decision. |
| 4 — Repository structure | Complete, pending initial commit | Git repository initialized on `main`; safeguards, monorepo skeleton, and repository documentation created. |
| 5 — Environment configuration | Implemented and automated checks verified | npm and isolated Python 3.12 dependencies installed; TypeScript type checks/builds, npm audit, Ruff, mypy, pip checks, imports, and health tests pass. Live MySQL readiness awaits a private least-privilege account and `.env` configuration. |
| 6 — Authentication | Complete and verified | Citizen registration `201`, login `200`, protected profile `200`, refresh rotation `200`, logout `204`, and revoked-token reuse `401` verified manually in Postman. Six automated security tests, type checks, production build, and dependency audit pass. |
| 7 — Department management | Complete and verified | Administrator operations, routing, Department Account status, cross-department scoping, and one-account-per-department protection verified. Duplicate creation returns `409`. |
| 8 — Complaint management | Complete and verified | Citizen submission/edit/list/detail/history, attachments, Department processing, Administrator search, negative authorization, transitions, and validation verified through Postman and automated/live tests. |
| 9 — API gateway and service integration | Complete and verified | Versioned discovery, protected service status, request-ID propagation, authorization denials, and structured `404` errors verified through Postman plus automated/live checks. |
| 10 — Frontend application | Complete and verified | Responsive three-role React UI, session rotation, complaint workflows, Administrator configuration, service readiness, accessibility, desktop/mobile QA, and authenticated Citizen/Department/Administrator walkthroughs verified. |
| 11 — GIS integration | Complete and verified | Citizen map selection, SRID 4326 storage, scoped marker maps, status/category/bounds/nearby filters, and Citizen/Department/Administrator authorization verified through automated and live tests. Authoritative Council boundaries remain `[NEEDS CONFIRMATION]`. |
| 12 — AI complaint classification | Complete and verified | Gemini structured classification, active-category validation, safe fallbacks, immutable attempt history, migration 008, Administrator approval/override, mapping-controlled routing, duplicate protection, role denial, responsive UI, and realistic live provider samples verified. No accuracy claim is made without a labelled evaluation dataset. |
| 13 — Optional ML experiment | Skipped by design | No suitable labelled dataset is available; the approved plan says not to force this phase. Gemini workflow evaluation continues with manually reviewed examples. |
| 14 — Department routing and reassignment | Complete and verified | Migration 009, Department requests, duplicate-pending protection, Administrator approval/rejection, transactional assignment history, unchanged complaint status, old/new Department isolation, responsive UI, automated tests, live role checks, and browser flows verified. |
| 15 — In-app notifications | Complete and verified | Migration 010, durable recipient-scoped history, unread state, preferences, deduplication, failure audit/logging, complaint/classification/reassignment event integration, cross-recipient denial, navigation badge, responsive notification centre, automated regression tests, live role checks, and browser flows verified. |
| 16 — Source-grounded RAG chatbot | Complete and verified | Authenticated Express adapter, Administrator-only PDF/DOCX/text ingestion and version governance, Gemini embeddings/generation, ChromaDB retrieval, citation validation, abstention, Citizen chatbot, responsive interfaces, automated security/business tests, live version/deactivation/reactivation workflow, role denials, and browser QA verified. No MySQL migration is required. |
| 17 — Reports and analytics | Implemented; API/data checks verified; visual QA pending | Strict type checks, builds, and 67 API/web tests pass. Database readiness restored; live login/report role checks pass. Nine reports reconcile against nine existing complaint records across system-wide and both Department scopes, with daily/weekly/monthly trends, distributions, durations and reassignment statistics verified. Department scope override is denied. User confirms Reports loads without errors; detailed desktop/mobile visual QA remains. No migration is required. |
| 18 onward | Not started | Requires phase approval after Phase 17 live verification. |

## Evidence policy

A phase is marked complete only when its required artifacts exist and its relevant verification has been performed. Deferred work remains visible here until completed.

