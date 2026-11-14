USE reporting_db;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS report_snapshots (
  id CHAR(36) PRIMARY KEY,
  report_type VARCHAR(80) NOT NULL,
  scope_type VARCHAR(30) NOT NULL,
  scope_id CHAR(36) NULL COMMENT 'External scope identifier, such as a department UUID',
  period_start DATETIME(3) NOT NULL,
  period_end DATETIME(3) NOT NULL,
  filters JSON NULL,
  payload JSON NOT NULL,
  generated_by_user_id CHAR(36) NULL COMMENT 'External auth_db user identifier; null for scheduled generation',
  generated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_report_period CHECK (period_end >= period_start),
  CONSTRAINT chk_report_scope CHECK (scope_type IN ('SYSTEM', 'DEPARTMENT')),
  INDEX idx_report_snapshots_type_period (report_type, period_start, period_end),
  INDEX idx_report_snapshots_scope (scope_type, scope_id, generated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS analytics_cache (
  cache_key VARCHAR(255) PRIMARY KEY,
  scope_type VARCHAR(30) NOT NULL,
  scope_id CHAR(36) NULL COMMENT 'External scope identifier, such as a department UUID',
  payload JSON NOT NULL,
  source_watermark DATETIME(3) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_analytics_scope CHECK (scope_type IN ('SYSTEM', 'DEPARTMENT')),
  INDEX idx_analytics_cache_expiry (expires_at),
  INDEX idx_analytics_cache_scope (scope_type, scope_id)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations (version) VALUES ('006_reporting_schema');

