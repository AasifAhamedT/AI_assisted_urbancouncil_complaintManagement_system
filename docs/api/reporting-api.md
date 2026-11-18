# Operational Reporting API

Phase 17 provides read-only complaint and reassignment reporting from authoritative `complaint_db` data. It does not copy or refresh data into `reporting_db`; derived snapshots remain deferred until a measured performance need justifies their lifecycle and consistency rules.

Base URL: `http://localhost:4000/api/v1/reports`

All successful JSON responses use `{ "data": ... }`. Errors use the standard `{ "error": { "code", "message", "requestId", "details?" } }` contract.

## Get the report overview

`GET /api/v1/reports/overview`

Roles: Department Account and Administrator. Citizens receive `403 FORBIDDEN`.

Headers:

```text
Authorization: Bearer <department-or-administrator-access-token>
Accept: application/json
```

Optional query parameters:

| Parameter | Values | Default |
|---|---|---|
| `from` | Inclusive `YYYY-MM-DD` date | 29 days before `to` |
| `to` | Inclusive `YYYY-MM-DD` date | Current UTC date |
| `bucket` | `day`, `week`, or `month` | `day` |
| `status` | An approved complaint status | All statuses |
| `categoryId` | Existing category UUID | All categories |
| `departmentId` | Existing department UUID; Administrator only | All departments |

The inclusive period may not exceed 366 days. Dates are evaluated using UTC boundaries and the response explicitly identifies the timezone and generation time.

Example Administrator request:

```text
GET /api/v1/reports/overview?from=2026-10-01&to=2026-11-16&bucket=week&departmentId=20000000-0000-4000-8000-000000000001
```

Expected: `200 OK` with:

- effective backend scope and reporting period;
- submitted, open, resolved, closed, rejected, and average-resolution metrics;
- status, category, and department distributions;
- submitted/resolved/closed time-series events;
- reassignment totals and average decision duration;
- authorized filter options.

## Scope and metric rules

- The backend derives a Department Account's department from its active account mapping. A Department caller cannot supply `departmentId`; attempting to do so returns `400 DEPARTMENT_FILTER_NOT_ALLOWED`.
- Administrator scope is system-wide unless an existing `departmentId` filter is supplied.
- Complaint totals and distributions use complaints submitted during the selected period and their current status, category, and current assignment.
- Submitted trend events use `created_at`; resolved and closed trend events use their corresponding event timestamps. A resolved/closed trend count can therefore include a complaint submitted before the selected period.
- Department complaint metrics use the complaint's current assignment. Department reassignment metrics use requests that originated from that department.
- Average resolution duration uses `submitted_at` through `resolved_at`, or `closed_at` when present, and reports its sample size.
- Reassignment is reported as a separate approval lifecycle and is never treated as complaint status.
- Inactive historical categories and departments remain available as report filters so old data does not lose its meaning.

## Negative cases

- `400 VALIDATION_ERROR`: malformed date, UUID, status, bucket, range longer than 366 days, or end before start.
- `400 INVALID_REPORT_FILTER`: category or Administrator-selected department does not exist.
- `400 DEPARTMENT_FILTER_NOT_ALLOWED`: a Department Account tries to control department scope.
- `401 AUTHENTICATION_REQUIRED`: no valid access token.
- `403 FORBIDDEN`: Citizen access.
- `403 DEPARTMENT_ACCESS_UNAVAILABLE`: Department Account has no active department mapping.

## Manual verification

1. Confirm `GET http://localhost:4000/ready` returns `200` with all six database flags `true`.
2. Sign in as an Administrator and request the default overview; confirm `scope.type` is `SYSTEM`.
3. Repeat with one valid `departmentId`; confirm the scope label and every department distribution row match that department.
4. Sign in as Department A and call the endpoint without `departmentId`; confirm `scope.type` is `DEPARTMENT` and `scope.departmentId` is Department A.
5. As Department A, supply Department B's ID; expect `400 DEPARTMENT_FILTER_NOT_ALLOWED` and no report data.
6. As a Citizen, call the endpoint; expect `403`.
7. Verify that changing dates and filters updates the response period and that UI totals match the API response.

No Phase 17 migration is required.

## Downloadable reports

On **Reports**, select the required period and filters, choose **Apply filters**, then **Download CSV** or **Download PDF**. Downloads contain the currently loaded report, including its scope, applied filters, UTC period, generation timestamp, metric definitions, summary, distributions, trends, and reassignment statistics. Unsaved filter edits do not change exported data. Export buttons are disabled while a report is loading or unavailable.

Both formats reuse the same report rows from the authorized API response. No new endpoint or database objects are required. Department exports retain backend-enforced department scope; unrelated selector options are not exported.

PDF uses lazy-loaded jsPDF with A4 pages, wrapped labels, repeated section headings on continuation pages, and page numbers. Browser canvas font fallback supports configurable English, Tamil, and Sinhala labels when those fonts are installed. Pages are embedded as images, so PDF text is not selectable/searchable or tagged for screen readers; use CSV for machine-readable data. The canvas renderer used by automated tests is a development-only dependency.

Manual browser check: after applying filters, download both formats and verify their date range, scope, and totals match the displayed report. Open the PDF in a viewer and check page breaks. A failed PDF export displays a retry message and leaves CSV available.
