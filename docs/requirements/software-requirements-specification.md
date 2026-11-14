# Software Requirements Specification

## Smart Urban Council Complaint Management System

**Phase:** 1 — Requirements Analysis  
**Status:** Draft for project-owner review  
**Client context:** Kinniya Urban Council  
**Important:** This document does not claim that the proposed system is approved, deployed, or officially adopted by the Council.

## 1. Purpose

This system will provide a centralized platform through which citizens submit and track urban-service complaints, departments process assigned complaints, and administrators configure and monitor the complaint workflow. It will include AI-assisted category recommendations, configurable department routing, GIS locations, notifications, analytics, and a document-grounded citizen chatbot.

## 2. Scope and release boundaries

### 2.1 Minimum viable product (MVP)

The MVP includes:

- Authentication and role-based authorization for Citizen, Department Account, and Administrator.
- Citizen complaint submission, attachments, location capture, and tracking.
- Configurable complaint categories and category-to-department mappings.
- AI-assisted category recommendation with safe failure handling.
- Backend-enforced department data isolation.
- Controlled complaint status transitions and complete activity history.
- Department notes, actions, information requests, and reassignment requests.
- Administrator review, reassignment, configuration, maps, and basic analytics.
- In-application notifications.
- A RAG chatbot grounded only in authorized documents.
- Audit-friendly records for important actions and AI recommendations.

### 2.2 Deferred enhancements

- Email, SMS, or push delivery of notifications.
- Cloud object storage and malware-scanning infrastructure.
- Advanced spatial analysis and predictive analytics.
- Native mobile applications.
- A separately trained complaint-classification model unless a suitable labelled dataset becomes available.
- Production high-availability infrastructure.
- Additional actor types or individual officer accounts.

## 3. Actors and authorization boundaries

The system has exactly three primary actor types.

### 3.1 Citizen

A Citizen can register, authenticate, manage their profile, submit complaints, view only their own complaints, respond to permitted information requests, view notifications, and use the public-information chatbot.

### 3.2 Department Account

A Department Account represents one department rather than an individual officer. It can access and process only complaints currently assigned to that department. Every protected backend request must derive the department identity from the authenticated account; a client-supplied department identifier must never be trusted as proof of access.

### 3.3 Administrator

An Administrator has system-wide configuration and monitoring privileges. Only an Administrator can manage Department Accounts, configure routing, override classifications or priorities, change assignments, and decide reassignment requests.

## 4. Functional requirements

Requirement identifiers are stable references for design, implementation, and testing.

### 4.1 Authentication and accounts

- **FR-AUTH-001:** The system shall allow a Citizen to register using validated identity and contact fields.
- **FR-AUTH-002:** The system shall authenticate all three actor types using securely hashed passwords.
- **FR-AUTH-003:** The system shall issue short-lived access tokens and revocable refresh tokens.
- **FR-AUTH-004:** The system shall allow an authenticated user to log out and revoke the relevant refresh token.
- **FR-AUTH-005:** The backend shall enforce role-based authorization for every protected operation.
- **FR-AUTH-006:** An inactive account shall not be permitted to authenticate or refresh a session.
- **FR-AUTH-007:** Only an Administrator shall create, update, activate, or deactivate a Department Account.
- **FR-AUTH-008:** Citizens shall access only their own profile, complaints, attachments, history, and notifications.

### 4.2 Departments, categories, and routing

- **FR-CONF-001:** An Administrator shall create, edit, activate, and deactivate departments.
- **FR-CONF-002:** An Administrator shall create, edit, activate, and deactivate complaint categories.
- **FR-CONF-003:** Categories and departments shall be stored as configurable data and shall not be hardcoded into business logic.
- **FR-CONF-004:** An Administrator shall configure category-to-department mappings.
- **FR-CONF-005:** The backend shall determine assignment from the approved category mapping; the AI service shall not select a department.
- **FR-CONF-006:** An unmapped category shall place the complaint into an administrator-review workflow without losing the submission.
- **FR-CONF-007:** Deactivation shall be preferred over destructive deletion when historical data refers to a record.

### 4.3 Complaint submission and citizen tracking

- **FR-CMP-001:** An authenticated Citizen shall submit a complaint with a title and description.
- **FR-CMP-002:** A complaint shall receive an immutable, unique, non-sequential public reference number.
- **FR-CMP-003:** The system shall validate complaint input on the backend.
- **FR-CMP-004:** A Citizen may supply a map location containing latitude and longitude.
- **FR-CMP-005:** A Citizen may upload validated supporting images or documents within configured limits.
- **FR-CMP-006:** The complaint shall be persisted before or independently of optional external AI processing so an AI failure cannot lose the submission.
- **FR-CMP-007:** A Citizen shall list and view only complaints that they own.
- **FR-CMP-008:** A Citizen shall see the current public status and appropriate history entries for their complaint.
- **FR-CMP-009:** A Citizen shall provide additional information when an authorized request is active.
- **FR-CMP-010:** Complaint lists shall support pagination and appropriate search, filter, and sort options.

### 4.4 Complaint processing and status workflow

- **FR-WRK-001:** A Department Account shall list and view only complaints assigned to its department.
- **FR-WRK-002:** The backend shall deny cross-department reads and writes even when a valid complaint identifier is supplied directly.
- **FR-WRK-003:** A Department Account shall record processing actions and internal notes.
- **FR-WRK-004:** Internal notes shall not be exposed to Citizens.
- **FR-WRK-005:** Status changes shall be accepted only when permitted by a centralized transition policy.
- **FR-WRK-006:** Every status change shall record the previous status, new status, actor, timestamp, and optional reason.
- **FR-WRK-007:** A Department Account may request additional information from the Citizen where the workflow permits it.
- **FR-WRK-008:** An Administrator shall be able to monitor and, with an audit reason, perform authorized workflow interventions.

### 4.5 Proposed status model

The following status model is proposed for approval:

| Current status | Permitted next status | Reason |
|---|---|---|
| `SUBMITTED` | `UNDER_REVIEW` | Complaint enters assessment. |
| `UNDER_REVIEW` | `IN_PROGRESS`, `AWAITING_INFORMATION`, `REJECTED` | Processing starts, clarification is needed, or the submission is invalid/out of scope. |
| `AWAITING_INFORMATION` | `UNDER_REVIEW` | Citizen information is received and review resumes. |
| `IN_PROGRESS` | `AWAITING_INFORMATION`, `RESOLVED` | More information is required or work is completed. |
| `RESOLVED` | `CLOSED`, `IN_PROGRESS` | Resolution is finalized or reopened with a reason. |
| `REJECTED` | `CLOSED`, `UNDER_REVIEW` | Rejection is finalized or reversed by an authorized review. |
| `CLOSED` | — | Terminal state; reopening requires an administrator decision and a separately approved rule. |

`REASSIGNMENT_REQUESTED` is not proposed as a complaint status. Reassignment is a parallel request lifecycle (`PENDING`, `APPROVED`, or `REJECTED`), which avoids replacing the complaint's actual processing state.

### 4.6 AI-assisted classification

- **FR-AI-001:** The backend shall send only the complaint information required for classification and the currently active category choices.
- **FR-AI-002:** The AI service shall return a schema-validated category recommendation, explanation, confidence indicator, and ambiguity indicator.
- **FR-AI-003:** The backend shall verify that a recommended category exists and is active.
- **FR-AI-004:** Invalid, unavailable, timed-out, or unsupported AI results shall cause a safe administrator-review fallback.
- **FR-AI-005:** The original AI result shall be stored separately from the final approved classification.
- **FR-AI-006:** An Administrator shall review and override a recommendation with an auditable reason.
- **FR-AI-007:** The system shall not represent model output as a final autonomous administrative decision.

### 4.7 Reassignment

- **FR-RAS-001:** A Department Account shall submit a reassignment request only for a complaint currently assigned to its department.
- **FR-RAS-002:** A reassignment request shall require a reason.
- **FR-RAS-003:** Only an Administrator shall approve or reject the request.
- **FR-RAS-004:** Approval shall update the assignment and preserve the previous assignment in history.
- **FR-RAS-005:** Rejection shall retain the current assignment and record the decision reason.
- **FR-RAS-006:** A department shall not gain access to the requested target department's data merely by submitting a request.

### 4.8 GIS

- **FR-GIS-001:** The system shall store validated complaint coordinates separately under the GIS data boundary.
- **FR-GIS-002:** Citizens shall select or confirm a complaint location on an OpenStreetMap-based map.
- **FR-GIS-003:** An Administrator shall view authorized complaint locations across the system.
- **FR-GIS-004:** A Department Account shall view map data only for complaints assigned to its department.
- **FR-GIS-005:** GIS API authorization shall follow the same complaint ownership and department-isolation rules as complaint APIs.

### 4.9 Notifications

- **FR-NOT-001:** Relevant complaint events shall create durable in-application notifications.
- **FR-NOT-002:** A user shall list and mark only their own notifications as read.
- **FR-NOT-003:** Notification creation failures shall be observable without corrupting the originating complaint operation.

### 4.10 RAG chatbot

- **FR-RAG-001:** Only authorized knowledge documents shall be ingested.
- **FR-RAG-002:** Only an Administrator shall manage knowledge documents.
- **FR-RAG-003:** Answers shall be grounded in retrieved document content and shall provide source references.
- **FR-RAG-004:** The chatbot shall abstain when the authorized knowledge base does not support an answer.
- **FR-RAG-005:** The chatbot shall not invent Council procedures, responsibilities, contact details, or policy.
- **FR-RAG-006:** Document versions and ingestion state shall be traceable.
- **FR-RAG-007:** Chatbot activity shall avoid exposing another user's private complaint data.

### 4.11 Reporting and administration

- **FR-REP-001:** Administrators shall view system-wide counts and trends by status, category, department, and time.
- **FR-REP-002:** Department Accounts shall view statistics only for their own department.
- **FR-REP-003:** Metrics shall be calculated from actual application data and shall identify their reporting period.
- **FR-REP-004:** Administrators shall view reassignment activity and complaint-processing durations.
- **FR-REP-005:** Authorized users shall filter map and dashboard data without bypassing access controls.

## 5. Non-functional requirements

### 5.1 Security and privacy

- **NFR-SEC-001:** Passwords shall be hashed using a modern adaptive password-hashing algorithm.
- **NFR-SEC-002:** Secrets shall be supplied through environment variables or an approved secret store and shall never be committed.
- **NFR-SEC-003:** Backend input shall be validated using explicit schemas.
- **NFR-SEC-004:** Database operations shall use parameterized queries or a safe data-access layer.
- **NFR-SEC-005:** Uploads shall be restricted by size, type, extension, and generated storage name.
- **NFR-SEC-006:** Authentication and sensitive endpoints shall be rate-limited.
- **NFR-SEC-007:** Production traffic shall use HTTPS.
- **NFR-SEC-008:** Logs shall not contain passwords, access tokens, refresh tokens, API keys, or unnecessary personal data.
- **NFR-SEC-009:** Security-relevant administrative actions shall produce audit records.
- **NFR-SEC-010:** Authorization shall be tested with direct API requests, including cross-citizen and cross-department identifiers.

### 5.2 Reliability and integrity

- **NFR-REL-001:** External AI or RAG service failure shall not make core complaint submission unavailable.
- **NFR-REL-002:** Multi-record state changes shall use transactions within the owning database where appropriate.
- **NFR-REL-003:** APIs shall return a consistent error structure and correlation identifier.
- **NFR-REL-004:** Important operations shall be idempotent where retries could otherwise create duplicates.
- **NFR-REL-005:** Database migrations shall be versioned and repeatable in a fresh environment.

### 5.3 Performance

- **NFR-PERF-001:** List endpoints shall use server-side pagination.
- **NFR-PERF-002:** Frequently filtered and joined fields shall receive justified indexes.
- **NFR-PERF-003:** Normal non-AI API operations should target a 95th-percentile response time below 1 second in the intended demonstration environment, excluding file transfer and external-service latency.
- **NFR-PERF-004:** Long-running AI and document-ingestion operations shall expose progress or a processing state rather than hold an HTTP request indefinitely.

### 5.4 Maintainability and extensibility

- **NFR-MNT-001:** React and Node.js code shall use TypeScript with strict type checking.
- **NFR-MNT-002:** Python services shall use type hints and Pydantic models.
- **NFR-MNT-003:** Business rules shall be separated from HTTP controllers and user-interface components.
- **NFR-MNT-004:** Service data ownership and API contracts shall be documented.
- **NFR-MNT-005:** Significant architectural decisions shall be recorded as Architecture Decision Records.
- **NFR-MNT-006:** Important business logic and authorization boundaries shall have automated tests.

### 5.5 Usability and accessibility

- **NFR-UX-001:** Interfaces shall be responsive for common desktop and mobile browser sizes.
- **NFR-UX-002:** Forms shall provide accessible labels and clear validation feedback.
- **NFR-UX-003:** Statuses shall not be communicated using color alone.
- **NFR-UX-004:** The initial language strategy is `[NEEDS CONFIRMATION]`.

### 5.6 Observability and operations

- **NFR-OPS-001:** Services shall provide health endpoints that do not expose secrets.
- **NFR-OPS-002:** Logs shall be structured and include timestamps, service identity, severity, and correlation identifiers.
- **NFR-OPS-003:** Configuration shall be environment-specific and validated at startup.
- **NFR-OPS-004:** Backup, recovery, and data-retention procedures shall be documented before production deployment.

## 6. Initial configurable data

### 6.1 Categories

1. Land
2. Environment
3. Solid Waste Management
4. Street/Public Lighting
5. Building
6. Other/Nuisance

### 6.2 Departments

1. Environment & Solid Waste Management Branch
2. Planning Branch
3. Revenue Branch

### 6.3 Confirmed initial mappings from the project brief

| Category | Department |
|---|---|
| Land | Planning Branch |
| Building | Planning Branch |
| Environment | Environment & Solid Waste Management Branch |
| Solid Waste Management | Environment & Solid Waste Management Branch |
| Street/Public Lighting | Environment & Solid Waste Management Branch |

The following remain `[NEEDS CONFIRMATION]`:

- Mapping for Other/Nuisance.
- Treatment of revenue and cash-related complaints.
- Whether revenue complaints require a seventh category.
- Whether Road Damage requires a separate category.
- Official department responsibilities and workflow procedures.

## 7. Core user stories and acceptance criteria

### US-001 — Citizen registration

As a Citizen, I want to create an account so that I can submit and track complaints.

**Acceptance criteria:**

- Valid registration creates one active Citizen account.
- Duplicate unique identity/contact values return a safe validation error.
- Passwords are never stored or returned in plaintext.
- The registration endpoint cannot create an Administrator or Department Account.

### US-002 — Submit a complaint

As a Citizen, I want to submit a complaint with evidence and a location so that the responsible department can process it.

**Acceptance criteria:**

- Valid required data creates exactly one complaint and public reference.
- Invalid text, coordinates, or files are rejected with field-level errors.
- AI unavailability does not discard or duplicate the complaint.
- The new complaint appears only in its owner's account and authorized administrative views.

### US-003 — Track a complaint

As a Citizen, I want to view my complaint's progress so that I understand its current state.

**Acceptance criteria:**

- The Citizen sees the current public status and citizen-visible history.
- Another Citizen's identifier does not provide access.
- Internal department notes are excluded.

### US-004 — Process an assigned complaint

As a Department Account, I want to process complaints assigned to my department.

**Acceptance criteria:**

- The department can list, view, and update its assigned complaints.
- Invalid status transitions are rejected.
- Every accepted transition is recorded in history.
- Direct reads or writes against another department's complaint return a denial without leaking sensitive details.

### US-005 — Configure routing

As an Administrator, I want to map categories to departments so that routing changes do not require source-code changes.

**Acceptance criteria:**

- Only an Administrator can change mappings.
- Only active, valid records can become active mappings.
- Mapping changes are auditable.
- New classifications use the applicable mapping without changing historical assignment records.

### US-006 — Review AI classification

As an Administrator, I want to review and override AI recommendations so that accountable human decisions remain possible.

**Acceptance criteria:**

- The original recommendation and explanation remain unchanged.
- An override requires a valid active category and audit reason.
- Routing uses the final approved category and configured mapping.
- Unsupported AI output enters manual review.

### US-007 — Request reassignment

As a Department Account, I want to request reassignment when a complaint is incorrectly routed.

**Acceptance criteria:**

- The request requires a non-empty reason.
- Only the currently assigned department can request it.
- Submission does not itself reassign the complaint.
- An Administrator's approval or rejection and reason are recorded.

### US-008 — View authorized GIS data

As an authorized user, I want to view relevant complaint locations on a map.

**Acceptance criteria:**

- Citizens see locations only for their complaints.
- Departments see locations only for assigned complaints.
- Administrators can view authorized system-wide locations.
- Direct GIS API calls enforce the same restrictions.

### US-009 — Ask the grounded chatbot

As a Citizen, I want answers based on authorized Council documents so that I can understand documented procedures.

**Acceptance criteria:**

- Supported answers include document source references.
- Unsupported questions receive an abstention rather than invented policy.
- Removed or inactive documents are not used for new answers after re-indexing.

### US-010 — View reports

As an authorized manager, I want complaint statistics so that I can monitor workload and outcomes.

**Acceptance criteria:**

- Administrator reports include system-wide authorized data.
- Department reports are limited to that department.
- Results identify the applied filters and time period.

## 8. Data ownership boundaries

| Logical database | Owning module | Principal data |
|---|---|---|
| `auth_db` | Authentication | Users, roles, refresh tokens, account state |
| `complaint_db` | Complaint management | Complaints, history, actions, attachments metadata, AI recommendations, reassignments |
| `department_db` | Department configuration | Departments, categories, account associations, routing mappings |
| `notification_db` | Notifications | Notifications and preferences |
| `gis_db` | GIS | Complaint locations and geographical areas |
| `reporting_db` | Reporting | Derived snapshots or caches only when justified |

Cross-boundary identifiers may be stored, but no cross-database foreign keys or direct cross-owner writes are proposed. Detailed schemas are deferred to Phase 3.

## 9. Assumptions pending project-owner confirmation

These are working assumptions, not approved Council facts:

- **A-001:** The recommended modular monorepo architecture is accepted provisionally.
- **A-002:** npm workspaces will manage the TypeScript applications.
- **A-003:** Development uploads will use local private storage; production object storage is deferred.
- **A-004:** Complaint tracking initially requires an authenticated Citizen session.
- **A-005:** Citizen registration initially requires email; phone support remains configurable and `[NEEDS CONFIRMATION]`.
- **A-006:** The first interface will be implemented in English, with internationalization support designed in; Tamil and Sinhala scope is `[NEEDS CONFIRMATION]`.
- **A-007:** Unconfirmed categories remain active only when approved, and unmapped categories enter administrator review.
- **A-008:** Docker installation may be deferred until infrastructure work, although installing it earlier is recommended.

## 10. Constraints and exclusions

- The project shall use React, Vite, TypeScript, Tailwind CSS, Node.js, Express, Python, FastAPI, MySQL, OpenStreetMap/Leaflet, Gemini, and ChromaDB unless a later approved decision records a justified change.
- The system shall not introduce additional primary actors without approval.
- The system shall not claim legal, policy, or procedural authority beyond confirmed source material.
- The system shall not depend on AI output for the durability of core complaint operations.
- Production retention periods, privacy notices, official service-level targets, and complaint appeal procedures remain `[NEEDS CONFIRMATION]`.

## 11. Phase 1 approval checklist

The project owner should confirm:

- [ ] MVP scope and deferred items are acceptable.
- [ ] The three actor definitions are correct.
- [ ] The proposed status workflow is acceptable.
- [ ] Reassignment should remain a parallel lifecycle rather than a complaint status.
- [ ] The working assumptions in Section 9 are acceptable or corrected.
- [ ] The initial categories, departments, and confirmed mappings are accurate.
- [ ] The project may proceed to Phase 2 architecture and diagrams.

