# Phase 15 Notification Test Report

Status: complete and verified.

## Automated coverage

- Bounded pagination and explicit unread-filter parsing.
- Strict preference schema rejects email/SMS enablement.
- Notification lists and unread counts use only the authenticated user ID.
- Cross-recipient read attempts return `404` without revealing record existence.
- Secure default preference is in-app enabled with email/SMS disabled.
- Final assignment creates Citizen and Department Account drafts.
- Status-event deduplication includes complaint version.
- Dispatch failure is recorded and logged without propagating to the originating workflow.
- The full API/frontend regression suite passes after migration 010.

## Data isolation

- `recipient_user_id` is never accepted from notification API input.
- List, count, mark-one, and mark-all queries include the authenticated user ID.
- Notification links do not bypass destination authorization.
- Metadata excludes complaint descriptions and credentials.

## Migration verification

Migration `010_notification_delivery_guards.sql` was applied successfully. Read-only verification confirmed:

- the migration ledger contains migration 010;
- `notifications.deduplication_key` exists;
- the deduplication key has a unique index; and
- `notification_dispatch_failures` exists.

## Live API verification

The Phase 15 verification script completed successfully against the local application and MySQL databases:

| Check | Result |
|---|---|
| Citizen complaint-submitted notification | Delivered |
| Citizen and Department assignment notifications | Delivered |
| Citizen status-change notification | Delivered |
| Administrator reassignment-request notification | Delivered |
| Requesting Department rejection notification | Delivered |
| Citizen, source Department, and target Department approval notifications | Delivered |
| Disabled recipient preference | Suppressed new delivery |
| Re-enabled recipient preference | Delivery restored |
| Cross-recipient mark-read attempt | `404` |
| Unauthenticated request | `401` |
| Mark one notification read | Unread count decreased from 5 to 4 |
| Mark all notifications read | Unread count decreased to 0 |

The database audit found no duplicate deduplication-key groups and no dispatch-failure records for the successful live workflow. Failure non-propagation and failure recording are covered by automated tests rather than by deliberately breaking the live environment.

## Browser verification

- Citizen mobile notification history, filters, preference state, and empty unread state rendered correctly.
- Administrator desktop notification history and unread navigation badge rendered correctly.
- Department Account desktop history contained only events addressed to that Department Account.
- No browser console errors or warnings were observed.
- No horizontal overflow was detected at the desktop viewport.
- The captured Department Account result is stored in [phase-15-browser-notifications.png](phase-15-browser-notifications.png).

## Test data note

The clearly labelled Phase 15 verification complaint and its notification history remain in the local development databases as non-production test evidence. No destructive cleanup was performed.
