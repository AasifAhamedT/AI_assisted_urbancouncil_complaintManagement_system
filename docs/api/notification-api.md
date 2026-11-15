# In-App Notification API

Phase 15 provides durable, recipient-scoped in-app notifications. Every endpoint requires a valid Bearer access token and derives the recipient from the authenticated user. Citizens, Department Accounts, and Administrators use the same API but can access only their own records.

Base URL: `http://localhost:4000/api/v1/notifications`

## List notification history

`GET /api/v1/notifications?page=1&pageSize=20&unreadOnly=false`

Header:

```text
Authorization: Bearer <access-token>
```

Expected: `200 OK` with recipient-owned `items` and pagination metadata. `unreadOnly` accepts only `true` or `false`.

Notification metadata may contain a safe internal application path and non-sensitive identifiers. Every destination API still performs its own authorization check.

## Unread count

`GET /api/v1/notifications/unread-count`

Expected:

```json
{
  "data": {
    "unreadCount": 3
  }
}
```

## Mark one as read

`PATCH /api/v1/notifications/{notificationId}/read`

Expected: `200 OK`. The operation is idempotent. An unknown notification or another user's notification returns the same `404 NOTIFICATION_NOT_FOUND` response.

## Mark all as read

`POST /api/v1/notifications/read-all`

Expected: `200 OK` with the number of changed records. Only the authenticated user's unread records are updated.

## Notification preference

- `GET /api/v1/notifications/preferences/me`
- `PUT /api/v1/notifications/preferences/me`

Update body:

```json
{
  "inAppEnabled": true
}
```

Expected: `200 OK`. If no row exists, the secure default is enabled in-app delivery. Email and SMS remain disabled and cannot be enabled through this API.

Disabling in-app delivery prevents new notification records for that account; existing history remains available.

## Integrated events

The module currently handles:

- `COMPLAINT_SUBMITTED` — Citizen confirmation.
- `COMPLAINT_ASSIGNED` — Citizen and final assigned Department Account after classification review.
- `COMPLAINT_STATUS_CHANGED` — Citizen, including specific resolved/closed titles.
- `REASSIGNMENT_REQUESTED` — Active Administrators.
- `REASSIGNMENT_APPROVED` — Requesting Department Account, Citizen, and newly assigned Department Account.
- `REASSIGNMENT_REJECTED` — Requesting Department Account.

Additional-information notification events will be added when that separate complaint workflow is implemented.

## Reliability and duplicate protection

Originating complaint, classification, and reassignment operations commit before notification delivery is queued. A notification failure therefore cannot roll them back. Failures are written to `notification_dispatch_failures` when possible and always produce a bounded structured log containing event type, aggregate ID, request ID, and safe failure code—never complaint content or credentials.

Every event-recipient pair uses a stable unique `deduplication_key`. Retried dispatch ignores an existing record instead of sending a duplicate.

## Negative cases

- Missing/invalid Bearer token: `401`.
- Invalid query/body/identifier: `400 VALIDATION_ERROR`.
- Unknown or another user's notification: `404 NOTIFICATION_NOT_FOUND`.
- Client attempts to enable email/SMS or submit recipient IDs: `400 VALIDATION_ERROR`.

## Migration requirement

Run `database/migrations/010_notification_delivery_guards.sql` in MySQL Workbench before live testing. It adds the nullable deduplication key to existing notification records, a unique guard for new events, the failure audit table, and the migration record. It contains no `DROP`, `DELETE`, or `TRUNCATE` statement.
