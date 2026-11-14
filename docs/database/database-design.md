# Database Design

## Smart Urban Council Complaint Management System

**Phase:** 3 — Database Design  
**Status:** Draft for project-owner approval  
**Database engine:** MySQL 8.0.43  
**Execution status:** SQL prepared but not executed

## 1. Design principles

- One MySQL Server hosts six logical databases.
- Each application module owns its database and is the only writer to its tables.
- Foreign keys are used only between tables in the same logical database.
- Cross-service references use `CHAR(36)` UUID values with indexes but no cross-database foreign keys.
- Operational records use UTC `DATETIME(3)` timestamps.
- Deactivation and soft deletion are preferred where historical records depend on data.
- Status values are constrained in the database and validated again in application business logic.
- Migration scripts are additive and non-destructive for initial setup.
- Application database credentials will not be stored in these scripts.

## 2. Identifier strategy

Internal identifiers use UUID strings stored as `CHAR(36)`. This is easy to inspect in Workbench, portable between Node.js and Python, and safe to pass across service boundaries. Public complaint references use a separate non-sequential string such as `KUC-2026-7K4M2P`; the exact generator will be implemented and tested in the Complaint Service.

UUID strings consume more index space than binary UUIDs, but their clarity is preferable for this project. A future optimization could migrate high-volume identifiers to `BINARY(16)` only with measured justification.

## 3. Database ownership summary

| Database | Owner | Tables |
|---|---|---|
| `auth_db` | Authentication module | `roles`, `users`, `refresh_tokens`, `schema_migrations` |
| `department_db` | Department module | `departments`, `categories`, `department_account_mappings`, `category_department_mappings`, `schema_migrations` |
| `complaint_db` | Complaint module | `complaints`, `complaint_status_history`, `complaint_attachments`, `complaint_actions`, `information_requests`, `ai_recommendations`, `assignment_history`, `reassignment_requests`, `schema_migrations` |
| `notification_db` | Notification module | `notifications`, `notification_preferences`, `schema_migrations` |
| `gis_db` | GIS module | `complaint_locations`, `geographical_areas`, `schema_migrations` |
| `reporting_db` | Reporting module | `report_snapshots`, `analytics_cache`, `schema_migrations` |

## 4. `auth_db`

### `roles`

Stores the three approved primary actor roles. `code` is unique and constrained by seed data to `CITIZEN`, `DEPARTMENT`, and `ADMINISTRATOR` at the application boundary.

### `users`

Stores authentication identity and account state. Email is normalized by the application and uniquely indexed. `password_hash` contains only an adaptive password hash. No plaintext password or reset secret is stored. `token_version` enables broad session invalidation after a security-sensitive event.

### `refresh_tokens`

Stores a cryptographic hash of each refresh token, never the raw token. Token-family, expiry, revocation, rotation, and reuse-detection fields support secure session management.

## 5. `department_db`

### `departments`

Stores configurable departments. The stable `code` is for application integration; the display name may change. `is_active` prevents new assignment without destroying history.

### `categories`

Stores configurable complaint categories. AI classification uses only active categories supplied by the backend.

### `department_account_mappings`

Associates an Auth Service user ID with one department. A user can have at most one active/current mapping in the initial design. The application verifies that the referenced user has the `DEPARTMENT` role through the Auth Service.

### `category_department_mappings`

Stores effective-dated routing configuration. A category has at most one current mapping because `category_id` is unique in the initial design. Mapping changes are audited with creator/updater identifiers.

## 6. `complaint_db`

### `complaints`

The complaint aggregate root. Citizen, category, and department identifiers refer to other service domains but are not foreign keys. `classification_state` distinguishes pending, recommended, approved, failed, and manual-review outcomes. `version` supports optimistic concurrency so two updates cannot silently overwrite one another.

### `complaint_status_history`

Immutable history of status transitions. The application is responsible for enforcing the approved transition graph before insertion.

### `complaint_attachments`

Stores metadata and a generated storage key, not file bytes. Original filenames are display-only and must never determine the storage path.

### `complaint_actions`

Stores processing actions and notes. `visibility` prevents internal notes from being returned to Citizens.

### `information_requests`

Tracks clarification requests and citizen responses independently from complaint status history.

### `ai_recommendations`

Preserves provider output and validation outcome separately from the final complaint category. Raw response storage is optional and must be sanitized of secrets.

### `assignment_history`

Records initial and changed department assignments, including the reason and responsible actor.

### `reassignment_requests`

Implements the parallel reassignment lifecycle. Approval does not occur through a status edit alone; application logic updates the request, complaint assignment, and assignment history in one `complaint_db` transaction.

## 7. `notification_db`

### `notifications`

Stores durable in-application notifications for one recipient user. Optional complaint ID is an external reference used to build an authorized link.

### `notification_preferences`

Stores per-user channel preferences. Only the in-app channel is initially operational; email and SMS fields prepare configuration without claiming those channels are implemented.

## 8. `gis_db`

### `complaint_locations`

Stores one WGS84 point per complaint using `POINT SRID 4326` and a spatial index. MySQL point construction uses longitude as X and latitude as Y. The API will accept conventional latitude/longitude fields and construct the point safely.

### `geographical_areas`

Provides optional named WGS84 multipolygons for future administrative-area filtering. Official boundaries and area names are `[NEEDS CONFIRMATION]`; no boundary seed data is included.

## 9. `reporting_db`

### `report_snapshots`

Stores immutable generated report payloads when scheduled or exported reporting is later required.

### `analytics_cache`

Stores expiring derived metrics. It is not a source of truth and can be rebuilt from owning services.

The reporting database begins empty. Duplication will be introduced only for a measured reporting need and with documented refresh rules.

## 10. Important constraints and indexes

- Unique normalized email and complaint reference.
- Unique department/category codes and names.
- Indexes for complaint citizen, assigned department, category, status, and creation time filters.
- Unique complaint location and spatial index on the WGS84 point.
- Unique active routing row per category in the initial schema.
- Unique notification preference row per user.
- Checks for coordinate accuracy, non-empty reasons, confidence range, file size, and valid status/priority values.
- Same-database foreign keys use restrictive deletion when history must be retained.

## 11. Transaction boundaries

The following operations require a transaction in their owning database:

- Complaint creation plus initial status history.
- Status update plus status history and version increment.
- Reassignment approval plus request decision, complaint assignment update, and assignment history.
- Refresh-token rotation plus old-token revocation and new-token insertion.

GIS location and notification records are in other databases. Their creation is coordinated through explicit service calls/events and observable retry logic rather than a distributed transaction.

## 12. Migration files

| File | Purpose |
|---|---|
| `database/migrations/000_create_databases.sql` | Creates the six logical databases if absent. |
| `database/migrations/001_auth_schema.sql` | Creates Auth Service tables and role seed data. |
| `database/migrations/002_department_schema.sql` | Creates department/category/routing tables and approved initial configuration. |
| `database/migrations/003_complaint_schema.sql` | Creates complaint workflow and history tables. |
| `database/migrations/004_notification_schema.sql` | Creates notification tables. |
| `database/migrations/005_gis_schema.sql` | Creates spatial tables and indexes. |
| `database/migrations/006_reporting_schema.sql` | Creates reporting snapshot/cache tables. |

The scripts use `CREATE DATABASE IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, and deterministic seed upserts. They contain no `DROP`, `TRUNCATE`, credential, or user-management statements.

## 13. Planned MySQL Workbench procedure

Do not run these scripts until the Phase 3 design is approved.

After approval:

1. Open MySQL Workbench.
2. Open the local MySQL 8.0 connection.
3. Confirm the connection target is the intended development server.
4. Open each migration file in numeric order, beginning with `000`.
5. Review the selected script before using the lightning-bolt execute action.
6. Check the Action Output panel for errors after each script.
7. Refresh the Schemas panel.
8. Verify all six databases and their expected tables.
9. Run only the read-only verification queries that will be supplied at execution time.
10. Do not paste database passwords into source files or chat.

## 14. Phase 3 decisions requiring approval

- [ ] Approve readable `CHAR(36)` UUID identifiers.
- [ ] Approve email as the initial unique Citizen login identifier.
- [ ] Approve the proposed complaint priorities: `LOW`, `NORMAL`, `HIGH`, and `URGENT`.
- [ ] Approve the tables and ownership boundaries.
- [ ] Approve WGS84 `POINT SRID 4326` location storage.
- [ ] Approve preparing to execute these migrations manually in Workbench.
- [ ] Confirm whether migration execution should occur next or be deferred until repository/environment setup.

