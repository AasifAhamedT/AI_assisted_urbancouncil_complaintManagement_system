# Postman

Import both JSON files in this directory into Postman and select the **Smart Urban Council Local** environment. The environment contains development-only sample data and empty token values; never export or commit an environment containing real tokens.

Run the Authentication requests in order: Register, Login, Current User, Refresh, and Logout. Login and Refresh automatically update the local Postman token variables.

Run Department Management before Complaint Management so an active category mapping and Department Account exist. The Complaint Management folder saves complaint IDs and versions automatically. For the attachment request, choose a local JPEG, PNG, WebP, or PDF as a binary body and set `X-Filename` to its filename.

The API Gateway Integration folder verifies versioned routing, a fresh Administrator token, timeout-safe internal readiness reporting, Citizen and unauthenticated denial, and the structured `404` contract. A reachable service may correctly report `configuration_required` until its later provider-integration phase.

## Phase 14 live verification

After migration 009 is applied and the local API is running, `verify-phase-14.ps1` exercises the complete reassignment workflow using the private local bootstrap and Postman test accounts. It creates clearly labelled development-only records, checks approval/rejection and Department isolation, and prints only status evidence—never passwords or tokens.

```powershell
./postman/verify-phase-14.ps1
```

The script is intentionally non-destructive and leaves its audit records in the local development databases.

After migration 010, `verify-phase-15.ps1` creates one clearly labelled complaint and exercises notification delivery for submission, final assignment, status change, reassignment request/decisions, recipient isolation, unread actions, and the in-app preference.

```powershell
./postman/verify-phase-15.ps1
```

