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

## Browser layout and CSV verification

The Reports page was inspected at desktop (1440 x 1000) and mobile (390 x 844) sizes, including monthly filtering. Evidence: `phase-17-reports-desktop.jpg` and `phase-17-reports-mobile.jpg`. A browser-downloaded CSV was inspected and contained the scoped metadata, 9 complaint submissions, and 6 reassignment requests for the selected report.

## Metric reconciliation and department isolation — 2026-11-16

`node postman/verify-phase-17.mjs` passed against the existing nine complaint records for the inclusive UTC period 2026-01-01 through 2026-11-16. The script independently calculates expected results from read-only database rows and compares them with ReportingService output. Nine reports were reconciled: system-wide plus both active Department mappings, each with daily, weekly, and monthly buckets.

Verified totals, open and terminal status counts, category/department distributions, resolution sample sizes and means, event bucket counts, reassignment status counts and decision durations. Both Department scopes contained only their own department, omitted department selector options, and rejected a supplied other-department filter. This checks the service/data boundary; actual HTTP login and authorization evidence is recorded above. No complaint or configuration records were modified.

The project owner also reported that the Reports page loaded without errors. Browser inspection is recorded separately above.

## PDF downloads — 2026-11-18

Added Download PDF alongside CSV. Both exports share the same row builder and use the loaded, backend-authorized report. The PDF library is loaded only when requested. No migration or backend change is required.

Verification: all 9 web tests passed (3 files), including valid PDF output, multilingual labels, scoped metrics, omission of unrelated filter options, a 366-day report with every daily row present and repeated trend headings, footer clearance, empty distributions, and unavailable-canvas error handling. The web production build and strict TypeScript check passed. A generated two-page synthetic report was rendered using Poppler; both pages were visually inspected for margins, wrapping, multilingual text, column alignment, and footers.

Live browser verification: signed in using the existing local Administrator account, opened Reports, and clicked Download PDF. The completed download was `council-report-system-2026-10-20-2026-11-18.pdf` (4 A4 pages, 495542 bytes). All four downloaded pages were rendered and inspected: matching scope/dates, 9 submitted/open complaints, category/department counts, all daily trend rows, and 6 reassignment requests (3 approved, 3 rejected). Repeated section headings and page footers remained readable. Browser evidence: `phase-17-pdf-download.png`. Initial localhost checks were blocked by sandbox socket restrictions; restarting only the test-started frontend/API outside that sandbox resolved connectivity without application code changes.

PDF text is rasterized to preserve browser font fallback; it is not searchable/selectable. CSV remains the machine-readable alternative. The dependency audit reports 5 high-severity findings in the existing Vite/Vitest build-tool dependency chain; none were reported against jsPDF. The existing Vite chunk-size advisory remains non-fatal.
