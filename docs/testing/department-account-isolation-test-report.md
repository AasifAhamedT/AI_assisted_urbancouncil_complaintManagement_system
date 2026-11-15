# Department Account Isolation Verification

Date: 2026-11-15

- Existing department-account mappings: 1.
- Departments with duplicate mappings before migration: 0.
- Migration `007_department_account_uniqueness`: recorded.
- Database constraint `uq_department_account_department`: present.
- Backend precondition rejects a second account for the same department.
- Live duplicate request: `409 DEPARTMENT_ACCOUNT_ALREADY_EXISTS`.
- API automated tests: 11 files, 24 tests passed.

Each Department Account has a unique Auth identity and maps to exactly one department. Each department has at most one Department Account. Complaint repository queries constrain Department actors with `assigned_department_id = <authenticated account department>`. A direct request for another department's complaint therefore returns the scoped not-found response without exposing that complaint.

The Administrator remains the only actor with system-wide complaint access.
