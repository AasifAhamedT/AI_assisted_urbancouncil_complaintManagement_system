# Phase 14 Reassignment Test Report

Status: complete and verified.

## Automated coverage

- Request reason validation and strict rejection of client-supplied Department identity.
- Approval target and decision-reason validation.
- Lifecycle filter validation and bounded pagination.
- Authenticated Department mapping used as the source scope.
- Cross-department complaint access returns the same not-found response.
- Duplicate pending request conflict handling.
- Active destination validation before Administrator approval.
- Administrator identity passed to the transactional decision record.
- Department request-list scoping.
- Existing authentication, complaint, department, GIS, classification, and gateway regression suites.

## Transaction and authorization design

- Request creation locks the complaint before validating its current assignment.
- Approval locks both request and complaint.
- Approval changes assignment, increments complaint version, records the decision, and inserts assignment history in one `complaint_db` transaction.
- Rejection records a decision without changing assignment.
- Complaint processing status is never used to represent reassignment state.
- Citizen access is denied at the route boundary.
- Department list and detail queries are scoped by the authenticated account mapping.

## Live verification

Migration 009 was confirmed through read-only checks: the migration record, approved-destination column, generated pending-request column, and unique pending-request constraint all exist.

The repeatable local script `postman/verify-phase-14.ps1` verified:

| Scenario | Result |
|---|---|
| Department submits an assigned complaint | `201` |
| Duplicate pending request | `409` |
| Citizen request-list access | `403` |
| Unauthenticated request-list access | `401` |
| Unrelated Department request-detail access | `404` |
| Administrator approval | `200` |
| Old Department complaint access after approval | `404` |
| New Department complaint access after approval | `200` |
| Repeated decision | `409` |
| Source Department access after rejection | `200` |
| Other Department access after rejection | `404` |

Approval preserved complaint status as `SUBMITTED`. Read-only database verification found the approved destination, decision actor/reason/time, and exactly one `REASSIGNMENT_APPROVAL` assignment-history row. The rejected record contains its decision audit fields and no approved destination.

## Browser verification

- Administrator approved-record view checked at 1440×900.
- Mobile layout checked at 428 px; a long-reason horizontal overflow was found and fixed.
- Department rejected-request ledger verified.
- Department complaint form enabled only after a valid reason.
- A Department request was submitted through the browser and then rejected through the Administrator browser flow.
- The final pending queue was empty.
- No browser console warnings or errors were recorded.

## Development test records

The live verification intentionally leaves two clearly named `Phase 14 ... verification` complaints, their immutable request/decision records, and one `Phase 14 Verification Department` test account in the local development databases. They were not deleted because destructive cleanup requires explicit project-owner approval.
