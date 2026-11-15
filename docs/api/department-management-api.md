# Department Management API

All endpoints use the prefix `http://127.0.0.1:4000/api/v1/admin` and require:

```text
Authorization: Bearer <administrator_access_token>
```

Citizen and Department tokens receive `403 Forbidden`. Missing or invalid tokens receive `401 Unauthorized`.

## Departments

- `GET /departments` — list all departments, including inactive records.
- `POST /departments` — create a department with `code`, `name`, and optional `description`.
- `PATCH /departments/:id` — update code, name, description, or `isActive`.

Codes use uppercase letters, digits, and underscores. Deactivation is preferred over deletion so historical identifiers remain valid.

## Categories

- `GET /categories` — list all configurable categories.
- `POST /categories` — create a category.
- `PATCH /categories/:id` — update or activate/deactivate a category.

Categories remain data-driven and are never hardcoded into complaint routing logic.

## Category routing

- `GET /category-mappings` — list configured mappings.
- `PUT /categories/:id/department-mapping` — create or replace the active mapping using `{ "departmentId": "uuid" }`.

Both category and department must be active. The backend—not Gemini—uses this mapping to select a department.

## Department Accounts

- `GET /department-accounts` — list account-to-department associations.
- `POST /department-accounts` — create a `DEPARTMENT` user and associate it with one active department.
- `PATCH /department-accounts/:userId/status` — set `ACTIVE`, `INACTIVE`, or `LOCKED`.

Only an Administrator can call these operations. Status changes increment the account token version. Deactivation and locking also revoke stored refresh tokens.

## Administrator bootstrap

Public registration cannot create an Administrator. Create the first local development Administrator through the one-time CLI command:

1. Copy `apps/api/.env.bootstrap.example` to `apps/api/.env.bootstrap`.
2. Replace all three values with a private email, unique password, and display name.
3. From the repository root run `npm run bootstrap:admin --workspace @sucms/api`.
4. Delete the local `.env.bootstrap` after successful creation. It is Git-ignored.

The bootstrap command still uses the Auth Service, Argon2id, database constraints, and duplicate-email protection. It does not bypass password hashing or write SQL directly.

