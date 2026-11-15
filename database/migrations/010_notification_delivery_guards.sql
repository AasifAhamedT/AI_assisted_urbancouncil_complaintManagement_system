USE notification_db;

SET @deduplication_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'notifications'
    AND column_name = 'deduplication_key'
);

SET @statement = IF(
  @deduplication_column_exists = 0,
  'ALTER TABLE notifications ADD COLUMN deduplication_key VARCHAR(255) NULL AFTER event_type',
  'SELECT ''deduplication_key already exists'' AS migration_status'
);

PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @deduplication_unique_exists = (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'notifications'
    AND constraint_name = 'uq_notifications_deduplication_key'
    AND constraint_type = 'UNIQUE'
);

SET @statement = IF(
  @deduplication_unique_exists = 0,
  'ALTER TABLE notifications ADD CONSTRAINT uq_notifications_deduplication_key UNIQUE (deduplication_key)',
  'SELECT ''uq_notifications_deduplication_key already exists'' AS migration_status'
);

PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

CREATE TABLE IF NOT EXISTS notification_dispatch_failures (
  id CHAR(36) PRIMARY KEY,
  event_type VARCHAR(80) NOT NULL,
  aggregate_id CHAR(36) NOT NULL COMMENT 'External owning-service aggregate identifier',
  failure_code VARCHAR(100) NOT NULL,
  request_id VARCHAR(100) NULL,
  failed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  INDEX idx_notification_failures_event_time (event_type, failed_at),
  INDEX idx_notification_failures_aggregate (aggregate_id, failed_at),
  INDEX idx_notification_failures_unresolved (resolved_at, failed_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations (version)
VALUES ('010_notification_delivery_guards');
