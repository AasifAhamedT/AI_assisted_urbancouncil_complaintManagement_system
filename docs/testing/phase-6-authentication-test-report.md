# Phase 6 Authentication Test Report

**Date:** 2026-11-14  
**Environment:** Local development  
**Status:** Passed

## Automated evidence

- TypeScript type checking: passed.
- Production builds: passed.
- API test files: 3 passed.
- API tests: 6 passed.
- npm audit: 0 vulnerabilities.
- Public registration with a supplied `ADMINISTRATOR` role: rejected with `400`.
- Protected current-user endpoint without a token: rejected with `401`.
- Invalid login input: rejected with structured `400` validation details.

## Manual Postman workflow

| Test | Expected | Observed | Result |
|---|---:|---:|---|
| Register Citizen | `201 Created` | `201` | Pass |
| Login | `200 OK` | `200` | Pass |
| Retrieve authenticated profile | `200 OK` | `200` | Pass |
| Rotate refresh token | `200 OK` | `200` | Pass |
| Logout | `204 No Content` | `204` | Pass |
| Reuse revoked refresh token | `401 Unauthorized` | `401` | Pass |

## Security observations

- Public registration creates the `CITIZEN` role only.
- Password hashes are not returned by API responses.
- Login and refresh scripts store tokens only in the selected local Postman environment.
- Refresh rotation invalidates the previous token.
- Logout revokes the current refresh token.
- A revoked token cannot establish a new session.

The local test Citizen created during this owner-approved workflow remains in the development database as intentional test data.

