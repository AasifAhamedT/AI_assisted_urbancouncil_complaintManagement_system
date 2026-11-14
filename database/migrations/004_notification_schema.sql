USE notification_db;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  recipient_user_id CHAR(36) NOT NULL COMMENT 'External auth_db user identifier',
  complaint_id CHAR(36) NULL COMMENT 'External complaint_db identifier',
  event_type VARCHAR(80) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  metadata JSON NULL,
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_notifications_recipient_read (recipient_user_id, read_at, created_at),
  INDEX idx_notifications_complaint (complaint_id, created_at),
  INDEX idx_notifications_event_time (event_type, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL COMMENT 'External auth_db user identifier',
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_notification_preferences_user UNIQUE (user_id)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations (version) VALUES ('004_notification_schema');

