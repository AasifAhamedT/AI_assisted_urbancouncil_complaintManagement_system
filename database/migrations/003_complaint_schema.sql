USE complaint_db;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaints (
  id CHAR(36) PRIMARY KEY,
  reference_number VARCHAR(30) NOT NULL,
  citizen_user_id CHAR(36) NOT NULL COMMENT 'External auth_db user identifier',
  category_id CHAR(36) NULL COMMENT 'External department_db category identifier',
  assigned_department_id CHAR(36) NULL COMMENT 'External department_db identifier',
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
  classification_state VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  classification_review_required BOOLEAN NOT NULL DEFAULT TRUE,
  version INT UNSIGNED NOT NULL DEFAULT 0,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  closed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_complaints_reference UNIQUE (reference_number),
  CONSTRAINT chk_complaints_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  CONSTRAINT chk_complaints_status CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'AWAITING_INFORMATION', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED')),
  CONSTRAINT chk_complaints_classification CHECK (classification_state IN ('PENDING', 'RECOMMENDED', 'APPROVED', 'FAILED', 'MANUAL_REVIEW')),
  INDEX idx_complaints_citizen_created (citizen_user_id, created_at),
  INDEX idx_complaints_department_status (assigned_department_id, status),
  INDEX idx_complaints_category_created (category_id, created_at),
  INDEX idx_complaints_status_created (status, created_at),
  INDEX idx_complaints_review_required (classification_review_required, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaint_status_history (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  previous_status VARCHAR(30) NULL,
  new_status VARCHAR(30) NOT NULL,
  changed_by_user_id CHAR(36) NOT NULL COMMENT 'External auth_db user identifier',
  reason VARCHAR(1000) NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_status_history_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  CONSTRAINT chk_status_history_previous CHECK (previous_status IS NULL OR previous_status IN ('SUBMITTED', 'UNDER_REVIEW', 'AWAITING_INFORMATION', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED')),
  CONSTRAINT chk_status_history_new CHECK (new_status IN ('SUBMITTED', 'UNDER_REVIEW', 'AWAITING_INFORMATION', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED')),
  INDEX idx_status_history_complaint_time (complaint_id, changed_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaint_attachments (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  uploaded_by_user_id CHAR(36) NOT NULL COMMENT 'External auth_db user identifier',
  original_filename VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  media_type VARCHAR(150) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  scan_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_attachments_storage_key UNIQUE (storage_key),
  CONSTRAINT fk_attachments_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  CONSTRAINT chk_attachments_size CHECK (size_bytes > 0),
  CONSTRAINT chk_attachments_scan CHECK (scan_status IN ('PENDING', 'CLEAN', 'REJECTED', 'FAILED')),
  INDEX idx_attachments_complaint_active (complaint_id, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaint_actions (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NOT NULL COMMENT 'External auth_db user identifier',
  actor_department_id CHAR(36) NULL COMMENT 'External department_db identifier',
  action_type VARCHAR(50) NOT NULL,
  note TEXT NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_actions_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  CONSTRAINT chk_actions_visibility CHECK (visibility IN ('INTERNAL', 'CITIZEN_VISIBLE')),
  INDEX idx_actions_complaint_time (complaint_id, created_at),
  INDEX idx_actions_department_time (actor_department_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS information_requests (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  requested_by_user_id CHAR(36) NOT NULL COMMENT 'External auth_db user identifier',
  request_text TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  response_text TEXT NULL,
  responded_by_user_id CHAR(36) NULL COMMENT 'External auth_db citizen identifier',
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  responded_at DATETIME(3) NULL,
  closed_at DATETIME(3) NULL,
  CONSTRAINT fk_information_requests_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  CONSTRAINT chk_information_requests_status CHECK (status IN ('OPEN', 'RESPONDED', 'CLOSED', 'CANCELLED')),
  INDEX idx_information_requests_complaint_status (complaint_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  prompt_version VARCHAR(50) NOT NULL,
  recommended_category_id CHAR(36) NULL COMMENT 'External department_db category identifier',
  confidence DECIMAL(5,4) NULL,
  is_ambiguous BOOLEAN NOT NULL DEFAULT FALSE,
  explanation TEXT NULL,
  validation_status VARCHAR(20) NOT NULL,
  failure_code VARCHAR(100) NULL,
  raw_response JSON NULL COMMENT 'Sanitized provider response; must contain no secrets',
  requested_at DATETIME(3) NOT NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_ai_recommendations_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  CONSTRAINT chk_ai_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT chk_ai_validation CHECK (validation_status IN ('VALID', 'INVALID', 'FAILED', 'TIMEOUT')),
  INDEX idx_ai_recommendations_complaint_time (complaint_id, created_at),
  INDEX idx_ai_recommendations_validation (validation_status, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assignment_history (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  previous_department_id CHAR(36) NULL COMMENT 'External department_db identifier',
  new_department_id CHAR(36) NOT NULL COMMENT 'External department_db identifier',
  changed_by_user_id CHAR(36) NOT NULL COMMENT 'External auth_db user identifier',
  source VARCHAR(30) NOT NULL,
  reason VARCHAR(1000) NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_assignment_history_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  CONSTRAINT chk_assignment_history_source CHECK (source IN ('INITIAL_ROUTING', 'ADMIN_OVERRIDE', 'REASSIGNMENT_APPROVAL')),
  INDEX idx_assignment_history_complaint_time (complaint_id, changed_at),
  INDEX idx_assignment_history_new_department (new_department_id, changed_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reassignment_requests (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  requested_by_user_id CHAR(36) NOT NULL COMMENT 'External auth_db department-account identifier',
  from_department_id CHAR(36) NOT NULL COMMENT 'External department_db identifier',
  suggested_department_id CHAR(36) NULL COMMENT 'External department_db identifier',
  reason VARCHAR(1000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  decided_by_user_id CHAR(36) NULL COMMENT 'External auth_db administrator identifier',
  decision_reason VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  decided_at DATETIME(3) NULL,
  CONSTRAINT fk_reassignment_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  CONSTRAINT chk_reassignment_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT chk_reassignment_reason CHECK (CHAR_LENGTH(TRIM(reason)) > 0),
  INDEX idx_reassignment_status_time (status, created_at),
  INDEX idx_reassignment_complaint_time (complaint_id, created_at),
  INDEX idx_reassignment_from_department (from_department_id, status)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations (version) VALUES ('003_complaint_schema');

