# Phase 8 Complaint Management Test Report

Date: 2026-11-15

## Automated verification

- TypeScript strict type-check: passed.
- Production build: passed.
- Vitest: 9 files, 17 tests passed.
- Postman collection and environment JSON parsing: passed.
- Existing authentication and department tests remained green.

Coverage includes input schemas, bounded pagination defaults, non-sequential public references, centralized status-transition rules, mandatory intervention reasons, role denial, and derivation of Citizen/Department/Administrator data scopes from the authenticated principal.

## Live API and MySQL verification

The localhost API and migrated MySQL databases were used for a three-role workflow:

| Check | Result |
|---|---:|
| Administrator, Department Account, and Citizen login | `200` |
| Citizen complaint creation | `201` |
| Citizen content update with version | `200` |
| Citizen filtered/paginated list | `200` |
| Citizen scoped complaint details | `200` |
| PDF attachment upload/list/download | `201` / `200` / `200` |
| Assigned Department complaint list | `200` |
| `SUBMITTED` to `UNDER_REVIEW` transition | `200` |
| Status history | `200`, two entries |
| Administrator reference search | `200` |
| Citizen status mutation attempt | `403` |
| Another Citizen direct-read attempt | `404 COMPLAINT_NOT_FOUND` |
| Invalid file signature for declared PDF | `415 ATTACHMENT_TYPE_MISMATCH` |
| Invalid `UNDER_REVIEW` to `CLOSED` transition | `409 INVALID_STATUS_TRANSITION` |

One development verification complaint, one small PDF attachment, and one isolation-test Citizen were intentionally created. The previously deactivated Department Account was reactivated through the Administrator API so department-scoped processing could be verified.

## Remaining manual evidence

The project owner should reimport the updated Postman collection/environment and run the **Complaint Management** folder in order. Attachment selection is manual because Postman does not embed a local file in the committed collection.

Production malware scanning and its rejection/retention policy remain `[NEEDS CONFIRMATION]`; uploaded files currently retain `scanStatus: PENDING` after signature and metadata validation.
