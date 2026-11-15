USE complaint_db;

-- Preserve the Administrator's actual approved destination separately from any
-- department suggestion. This remains an external department_db identifier.
SET @approved_department_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'reassignment_requests'
    AND column_name = 'approved_department_id'
);

SET @statement = IF(
  @approved_department_column_exists = 0,
  'ALTER TABLE reassignment_requests ADD COLUMN approved_department_id CHAR(36) NULL COMMENT ''External department_db identifier approved by the Administrator'' AFTER suggested_department_id',
  'SELECT ''approved_department_id already exists'' AS migration_status'
);

PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

-- MySQL UNIQUE indexes permit multiple NULLs. The generated value is populated
-- only while a request is PENDING, enforcing one pending request per complaint.
SET @pending_complaint_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'reassignment_requests'
    AND column_name = 'pending_complaint_id'
);

SET @statement = IF(
  @pending_complaint_column_exists = 0,
  'ALTER TABLE reassignment_requests ADD COLUMN pending_complaint_id CHAR(36) GENERATED ALWAYS AS (CASE WHEN status = ''PENDING'' THEN complaint_id ELSE NULL END) STORED',
  'SELECT ''pending_complaint_id already exists'' AS migration_status'
);

PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @pending_unique_exists = (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'reassignment_requests'
    AND constraint_name = 'uq_reassignment_pending_complaint'
    AND constraint_type = 'UNIQUE'
);

-- This fails safely without deleting data if duplicate pending requests already exist.
SET @statement = IF(
  @pending_unique_exists = 0,
  'ALTER TABLE reassignment_requests ADD CONSTRAINT uq_reassignment_pending_complaint UNIQUE (pending_complaint_id)',
  'SELECT ''uq_reassignment_pending_complaint already exists'' AS migration_status'
);

PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @approved_department_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'reassignment_requests'
    AND index_name = 'idx_reassignment_approved_department'
);

SET @statement = IF(
  @approved_department_index_exists = 0,
  'ALTER TABLE reassignment_requests ADD INDEX idx_reassignment_approved_department (approved_department_id, decided_at)',
  'SELECT ''idx_reassignment_approved_department already exists'' AS migration_status'
);

PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

INSERT IGNORE INTO schema_migrations (version)
VALUES ('009_reassignment_workflow_guards');
