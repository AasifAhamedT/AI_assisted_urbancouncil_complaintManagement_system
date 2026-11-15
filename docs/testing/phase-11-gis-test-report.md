# Phase 11 GIS Test Report

Date: 2026-11-15

## Automated verification

- API strict TypeScript check: passed.
- Web strict TypeScript check: passed.
- API tests: 13 files, 30 tests passed.
- Web tests: 1 file, 2 tests passed.
- API and web production builds: passed.
- GIS schema tests cover coordinate ranges, complete/ordered bounds, and complete nearby-search parameters.
- GIS service tests cover complaint-policy authorization, Department update denial, and use of policy-approved complaint IDs.

## Live API verification

Verified against the local MySQL-backed API:

| Case | Result |
|---|---|
| Citizen creates a routed complaint | `201` |
| Owning Citizen saves a location | `200` |
| Stored point reads as latitude `8.49`, longitude `81.18` | Passed |
| Owning Citizen gets the location | `200` |
| Nearby search within 1,000 m contains the complaint | Passed |
| Assigned Department Account marker list contains the complaint | Passed |
| Administrator bounding box contains the complaint | Passed |
| Latitude `91` | `400` |
| Department Account tries to update location | `403` |
| Different Citizen gets the location | `404` |
| Different Citizen marker list contains the complaint | No |

The verification created one clearly named `Phase 11 GIS verification` complaint and one clearly named isolation-test Citizen in the local development database. No production or official Council deployment is claimed.

## Defect found and corrected

The first live run exposed SRID 4326 axis-order inversion. `ST_SRID(POINT(...), 4326)` interpreted coordinate axes according to the SRS and returned longitude as latitude. Storage and distance queries now construct points with `ST_GeomFromText(..., 4326, 'axis-order=long-lat')`, and reads use `ST_Latitude` / `ST_Longitude`. The corrected values, nearby query, and bounding box were verified live.

## Deferred confirmation

Authoritative Council boundary geometry, boundary source attribution, and administrative-area maintenance procedures remain `[NEEDS CONFIRMATION]`.
