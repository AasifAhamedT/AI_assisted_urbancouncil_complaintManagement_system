# Department Reassignment API

Phase 14 implements reassignment as a separate approval lifecycle. It never changes complaint processing status. Authentication is required for every endpoint, and the backend derives Department identity from the authenticated Department Account mapping.

Base URL: `http://localhost:4000/api/v1/reassignments`

All successful JSON responses use `{ "data": ... }`. Errors use the standard `{ "error": { "code", "message", "requestId", "details?" } }` contract.

## Submit a request

`POST /api/v1/reassignments`

Role: Department Account only.

Headers:

```text
Authorization: Bearer <department-access-token>
Content-Type: application/json
```

Body:

```json
{
  "complaintId": "30000000-0000-4000-8000-000000000001",
  "reason": "This drainage complaint belongs to the engineering department."
}
```

Expected: `201 Created`. The response contains a `PENDING` request. The complaint remains assigned to the requesting department.

Rules:

- The complaint must currently be assigned to the authenticated department.
- Classification review must be complete.
- A closed complaint cannot be reassigned.
- Only one pending request may exist per complaint.
- The client cannot supply or override its source Department identity.

Negative cases include `400 VALIDATION_ERROR`, `404 COMPLAINT_NOT_FOUND`, `409 REASSIGNMENT_ALREADY_PENDING`, `409 CLASSIFICATION_REVIEW_REQUIRED`, and `409 COMPLAINT_CLOSED`.

## List authorized requests

`GET /api/v1/reassignments?page=1&pageSize=20&status=PENDING`

Roles: Department Account and Administrator.

- A Department Account receives only requests originating from its own mapped department.
- An Administrator receives the system-wide queue.
- `status` is optional and accepts `PENDING`, `APPROVED`, `REJECTED`, or `CANCELLED`.

Expected: `200 OK` with `items` and pagination metadata.

## Get one authorized request

`GET /api/v1/reassignments/{requestId}`

Roles: Department Account and Administrator. Department scoping is enforced in the query. An inaccessible or unknown request returns `404 REASSIGNMENT_NOT_FOUND`.

## Decide a request

`POST /api/v1/reassignments/{requestId}/decision`

Role: Administrator only.

Approval body:

```json
{
  "decision": "APPROVED",
  "targetDepartmentId": "20000000-0000-4000-8000-000000000002",
  "decisionReason": "The target department is responsible for drainage maintenance."
}
```

Rejection body:

```json
{
  "decision": "REJECTED",
  "decisionReason": "The configured responsibilities confirm the existing assignment."
}
```

Expected: `200 OK`.

Approval validates that the target Department is active, locks the request and complaint, confirms the assignment has not changed, updates only `assigned_department_id`, increments the complaint version, records the decision, and inserts `REASSIGNMENT_APPROVAL` assignment history in one `complaint_db` transaction. Complaint status remains unchanged.

Negative cases include `400 REASSIGNMENT_SAME_DEPARTMENT`, `404 REASSIGNMENT_NOT_FOUND`, `409 REASSIGNMENT_ALREADY_DECIDED`, `409 REASSIGNMENT_STALE_ASSIGNMENT`, `409 DEPARTMENT_INACTIVE`, `401`, and `403`.

## Migration requirement

Run `database/migrations/009_reassignment_workflow_guards.sql` in MySQL Workbench before using these endpoints. It adds the approved destination audit field and a unique generated-column guard that permits only one pending reassignment per complaint. It contains no `DROP`, `DELETE`, or `TRUNCATE` statement.
