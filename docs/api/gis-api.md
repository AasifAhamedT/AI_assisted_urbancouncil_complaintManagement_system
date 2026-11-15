# GIS API

Base path: `/api/v1/gis`

All endpoints require `Authorization: Bearer <access_token>`. GIS data is stored only in `gis_db`. Before returning or changing a location, the API asks the Complaint service to enforce Citizen ownership, Department assignment, or Administrator access. A client cannot provide a Citizen ID or Department ID to expand its scope.

## Save or correct a complaint location

`PUT /complaints/:id/location`

Roles: owning Citizen while the complaint is `SUBMITTED`, or Administrator. Department Accounts cannot change locations.

Headers:

```text
Authorization: Bearer <access_token>
Content-Type: application/json
```

Body:

```json
{
  "latitude": 8.49,
  "longitude": 81.18,
  "addressText": "Optional address description",
  "locationDescription": "Optional landmark",
  "accuracyMeters": 15
}
```

Expected: `200 OK` with the saved location. Latitude must be from `-90` to `90`; longitude must be from `-180` to `180`; invalid coordinates return `400 VALIDATION_ERROR`. An inaccessible complaint returns `404 COMPLAINT_NOT_FOUND` without revealing ownership. A Citizen attempting to edit after `SUBMITTED` receives `409 LOCATION_NOT_EDITABLE`. A Department Account receives `403`.

The complaint is created before the optional location request. A GIS or map-tile failure therefore does not roll back or lose the core complaint.

## Get one location

`GET /complaints/:id/location`

Roles and scope:

- Citizen: owned complaint only.
- Department Account: complaint assigned to its active department only.
- Administrator: any complaint.

Expected: `200 OK`. A scoped complaint without a location returns `404 LOCATION_NOT_FOUND`; an inaccessible complaint returns `404 COMPLAINT_NOT_FOUND`.

## List authorized markers

`GET /markers`

Optional filters:

```text
status=IN_PROGRESS
categoryId=<category UUID>
north=9&south=8&east=82&west=81
latitude=8.49&longitude=81.18&radiusMeters=1000
```

Bounding-box values must be supplied together and ordered correctly. Nearby-search values must also be supplied together. The result is limited to 500 markers after complaint authorization.

Department Account scope is derived from the authenticated account-to-department mapping. It never accepts a Department ID query parameter.

## Spatial data notes

- Points use MySQL SRID 4326.
- Construction explicitly uses `axis-order=long-lat`; output uses `ST_Latitude` and `ST_Longitude` to prevent coordinate inversion.
- Nearby search uses `ST_Distance_Sphere` and returns meters.
- Council administrative boundary data is not displayed because an authoritative boundary source remains `[NEEDS CONFIRMATION]`.
