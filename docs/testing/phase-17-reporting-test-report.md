# Phase 17 Reporting Test Report

**Status:** Implemented; automated verification and live role/API checks passed; authenticated reports-page visual verification remains pending.

## Implemented coverage

- Read-only operational overview sourced from authoritative complaint and reassignment tables.
- Administrator system-wide and optional department-filtered scope.
- Backend-derived Department Account scope with client department selection rejected.
- Inclusive UTC reporting period, maximum 366-day range, and day/week/month buckets.
- Status, category, department, trend, processing-duration, and reassignment metrics.
- Responsive React reports page with visible period/scope, filters, distributions, trend bars, and sample sizes.
- Role-aware navigation and dashboard quick links.
- No migration and no reporting cache were introduced.

## Automated evidence

Executed on 2026-11-16:

| Check | Result |
|---|---|
| API strict TypeScript check | Passed |
| Web strict TypeScript check | Passed |
| API production build | Passed |
| Web production build | Passed; existing Vite chunk-size advisory only |
| API automated tests | 24 files, 65 tests passed |
| Web automated tests | 1 file, 2 tests passed |

New tests cover date defaults/range validation, authenticated Department scope derivation, rejection of client-controlled Department scope, Administrator department filtering, Citizen denial, and unauthenticated route denial.

The first sandboxed API test attempt could not open Supertest's temporary localhost port (`EACCES`). The suite was rerun with localhost test permission and all 65 tests passed; this was an execution-environment restriction, not an application failure.

## Database recovery and live verification — 2026-11-16

The earlier `503` was caused by the running API retaining the old MySQL credentials. Workbench confirmed the account rename and password change had succeeded. A fresh connection with the saved `.env` succeeded; restarting the existing API restored all six database readiness flags to `true`. The development watcher now includes `.env` so future saved configuration changes restart the API.

Live checks returned `200` for all three account logins, Administrator reporting (9 current-period complaints), department-filtered Administrator reporting (7), and Department reporting (7). Department-supplied scope was rejected with `400 DEPARTMENT_FILTER_NOT_ALLOWED`; Citizen reports were rejected with `403`; an impossible calendar date was rejected with `400 VALIDATION_ERROR`. Credentials and tokens were not printed. Browser inspection also confirmed the ready response. Classifier and RAG readiness both returned ready.

Additional fixes clear stale report results after a failed filter request and allow the report filter grid to wrap within the available width. The API test setup now loads dependencies before timing HTTP assertions, fixing a cold-import timeout. Final checks: 65 API tests, 2 web tests, 5 classifier tests, and 7 RAG tests passed; TypeScript checks and both production builds passed. Vite still emits its non-fatal chunk-size advisory. Sandboxed Python tests stalled; their identified processes were stopped and the tests passed outside the sandbox.

## Remaining verification

- Desktop and narrow/mobile report layouts are inspected in the browser.

## Metric reconciliation and department isolation — 2026-11-16

`node postman/verify-phase-17.mjs` passed against the existing nine complaint records for the inclusive UTC period 2026-01-01 through 2026-11-16. The script independently calculates expected results from read-only database rows and compares them with ReportingService output. Nine reports were reconciled: system-wide plus both active Department mappings, each with daily, weekly, and monthly buckets.

Verified totals, open and terminal status counts, category/department distributions, resolution sample sizes and means, event bucket counts, reassignment status counts and decision durations. Both Department scopes contained only their own department, omitted department selector options, and rejected a supplied other-department filter. This checks the service/data boundary; actual HTTP login and authorization evidence is recorded above. No complaint or configuration records were modified.

The project owner also reported that the Reports page loaded without errors. Detailed desktop/mobile visual inspection remains distinct from that user confirmation.
