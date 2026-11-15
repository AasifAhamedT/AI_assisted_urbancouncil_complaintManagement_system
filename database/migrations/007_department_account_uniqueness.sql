USE department_db;

-- A Department Account represents the department itself, not an individual officer.
SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'department_account_mappings'
    AND constraint_name = 'uq_department_account_department'
    AND constraint_type = 'UNIQUE'
);

-- ALTER fails safely without deleting data if duplicate department mappings exist.
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE department_account_mappings ADD CONSTRAINT uq_department_account_department UNIQUE (department_id)',
  'SELECT ''uq_department_account_department already exists'' AS migration_status'
);

PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

INSERT IGNORE INTO schema_migrations (version)
VALUES ('007_department_account_uniqueness');
