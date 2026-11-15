# Complaint Management API

Base path: `/api/v1/complaints`

All endpoints require `Authorization: Bearer <access_token>`. The backend derives Citizen ownership and Department assignment from that token. A client-supplied Citizen or Department identifier is never accepted as access proof. Inaccessible complaint identifiers return `404` without disclosing whether another actor owns them.

## Active category choices

`GET /categories`

Returns active categories that can be supplied during complaint creation. Assignment is resolved by the backend from the active category-to-department mapping. An active category without an active mapping is accepted but enters manual review.

## Submit a complaint

`POST /`

Role: Citizen only.

```json
{
  "title": "Blocked roadside drain",
  "description": "The roadside drain has overflowed for several days.",
  "categoryId": "optional-active-category-uuid"
}
```

Expected: `201 Created`. The complaint and initial `SUBMITTED` history entry are committed together. It receives an immutable non-sequential reference such as `KUC-2026-AB23CD45`. If no valid department mapping exists, the complaint remains durable with `classificationReviewRequired: true`.

Negative cases: non-Citizen token `403`, inactive category `400`, unknown fields or invalid input `400`, missing token `401`.

## Search and list

`GET /?page=1&pageSize=20&search=drain&status=SUBMITTED&priority=NORMAL&categoryId=<uuid>&sortBy=createdAt&sortOrder=desc`

Roles and enforced scope:

- Citizen: owned complaints only.
- Department Account: complaints assigned to its active department only.
- Administrator: all complaints.

`pageSize` is limited to 100. Supported sort fields are `createdAt`, `updatedAt`, `referenceNumber`, `status`, and `priority`.

## Details and Citizen edits

- `GET /:id` — scoped complaint details.
- `PATCH /:id` — owning Citizen may edit title or description only while status is `SUBMITTED`.

Edit body:

```json
{
  "title": "Updated complaint title",
  "version": 0
}
```

The current `version` is required. Concurrent or stale updates return `409 COMPLAINT_VERSION_CONFLICT`.

## Status and history

- `PATCH /:id/status` — assigned Department Account or Administrator.
- `GET /:id/history` — scoped status history.

```json
{
  "status": "UNDER_REVIEW",
  "version": 1,
  "reason": "Required for Administrator interventions and selected reversal/rejection transitions."
}
```

Approved transitions are centralized:

- `SUBMITTED` → `UNDER_REVIEW`
- `UNDER_REVIEW` → `IN_PROGRESS`, `AWAITING_INFORMATION`, or `REJECTED`
- `AWAITING_INFORMATION` → `UNDER_REVIEW`
- `IN_PROGRESS` → `AWAITING_INFORMATION` or `RESOLVED`
- `RESOLVED` → `CLOSED` or `IN_PROGRESS`
- `REJECTED` → `CLOSED` or `UNDER_REVIEW`
- `CLOSED` is terminal pending an approved reopening rule.

Invalid transitions return `409`. Every successful transition increments `version` and records immutable history.

## Attachments

### Upload

`POST /:id/attachments`

Role: owning Citizen. Send the file as the raw binary request body with:

```text
Authorization: Bearer <access_token>
Content-Type: image/jpeg | image/png | image/webp | application/pdf
X-Filename: evidence.pdf
```

Expected: `201 Created`. Maximum size defaults to 10 MB and is configured with `MAX_ATTACHMENT_BYTES`. Filename, extension, media type, file signature, generated storage name, and SHA-256 checksum are validated. Files are stored outside the public web tree.

New files retain `scanStatus: PENDING`; production malware-scanning and rejection policy remain `[NEEDS CONFIRMATION]`.

### List and download

- `GET /:id/attachments`
- `GET /:id/attachments/:attachmentId/content`

Both reuse complaint ownership and department-isolation checks. Storage keys are never returned.

