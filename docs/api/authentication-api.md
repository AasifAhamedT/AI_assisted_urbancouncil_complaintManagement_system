# Authentication API

**Base URL:** `http://127.0.0.1:4000/api/v1/auth`

All JSON errors use:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe description",
    "requestId": "correlation-identifier"
  }
}
```

## Register a Citizen

`POST /register`

```json
{
  "email": "citizen@example.com",
  "password": "SecurePassword123",
  "displayName": "Example Citizen",
  "phoneNumber": "+94770000000"
}
```

Expected: `201 Created`. Public registration always creates a `CITIZEN`. Supplying `role`, `status`, or other unknown fields returns `400`; it can never create a Department Account or Administrator.

Negative cases: invalid email, password shorter than 12 characters, missing name, invalid phone, duplicate email, extra `role` field, and rate limiting.

## Login

`POST /login`

```json
{
  "email": "citizen@example.com",
  "password": "SecurePassword123"
}
```

Expected: `200 OK` with public user information, a short-lived access token, and a rotating refresh token. Invalid email and invalid password deliberately return the same `401 INVALID_CREDENTIALS` response.

Inactive accounts return `403`; locked accounts return `423`.

## Current user

`GET /me`

Header:

```text
Authorization: Bearer <access_token>
```

Expected: `200 OK` with the authenticated user's public profile. Missing, invalid, expired, or revoked tokens return `401`.

## Refresh session

`POST /refresh`

```json
{
  "refreshToken": "<refresh_token>"
}
```

Expected: `200 OK` with a new access token and refresh token. The submitted refresh token is revoked during rotation. Reuse revokes its token family and returns `401`.

## Logout

`POST /logout`

```json
{
  "refreshToken": "<latest_refresh_token>"
}
```

Expected: `204 No Content`. The refresh token is revoked. Previously issued access tokens remain short-lived but every protected request also checks current account status and token version.

## Security notes

- Passwords are hashed using Argon2id.
- Refresh tokens are stored only as SHA-256 hashes.
- Access and refresh JWTs use different secrets.
- Refresh rotation is transactional.
- Authentication endpoints are rate-limited.
- Protected requests reload the account to enforce deactivation and locking immediately.
- API responses never include password hashes or stored refresh-token hashes.

