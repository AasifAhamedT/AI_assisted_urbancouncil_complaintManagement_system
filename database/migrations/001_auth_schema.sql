USE auth_db;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roles (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_roles_code UNIQUE (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  role_id CHAR(36) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  phone_number VARCHAR(30) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  email_verified_at DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  password_changed_at DATETIME(3) NULL,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  CONSTRAINT chk_users_status CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE', 'LOCKED')),
  INDEX idx_users_role_status (role_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  family_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  replaced_by_token_id CHAR(36) NULL,
  reuse_detected_at DATETIME(3) NULL,
  created_by_ip VARCHAR(45) NULL,
  revoked_by_ip VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_tokens_replacement FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  INDEX idx_refresh_tokens_user_expiry (user_id, expires_at),
  INDEX idx_refresh_tokens_family (family_id)
) ENGINE=InnoDB;

INSERT INTO roles (id, code, display_name, description) VALUES
  ('10000000-0000-4000-8000-000000000001', 'CITIZEN', 'Citizen', 'Citizen self-service account'),
  ('10000000-0000-4000-8000-000000000002', 'DEPARTMENT', 'Department Account', 'Account representing one department'),
  ('10000000-0000-4000-8000-000000000003', 'ADMINISTRATOR', 'Administrator', 'System administration account')
AS incoming
ON DUPLICATE KEY UPDATE
  display_name = incoming.display_name,
  description = incoming.description;

INSERT IGNORE INTO schema_migrations (version) VALUES ('001_auth_schema');

