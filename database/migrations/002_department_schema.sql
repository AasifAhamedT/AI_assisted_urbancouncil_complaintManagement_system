USE department_db;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS departments (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id CHAR(36) NULL COMMENT 'External auth_db user identifier',
  updated_by_user_id CHAR(36) NULL COMMENT 'External auth_db user identifier',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_departments_code UNIQUE (code),
  CONSTRAINT uq_departments_name UNIQUE (name),
  INDEX idx_departments_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id CHAR(36) NULL COMMENT 'External auth_db user identifier',
  updated_by_user_id CHAR(36) NULL COMMENT 'External auth_db user identifier',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_categories_code UNIQUE (code),
  CONSTRAINT uq_categories_name UNIQUE (name),
  INDEX idx_categories_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS department_account_mappings (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL COMMENT 'External auth_db user identifier',
  department_id CHAR(36) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by_user_id CHAR(36) NOT NULL COMMENT 'External auth_db administrator identifier',
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deactivated_at DATETIME(3) NULL,
  CONSTRAINT uq_department_account_user UNIQUE (user_id),
  CONSTRAINT fk_department_account_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  INDEX idx_department_accounts_department_active (department_id, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS category_department_mappings (
  id CHAR(36) PRIMARY KEY,
  category_id CHAR(36) NOT NULL,
  department_id CHAR(36) NOT NULL,
  effective_from DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id CHAR(36) NULL COMMENT 'External auth_db administrator identifier',
  updated_by_user_id CHAR(36) NULL COMMENT 'External auth_db administrator identifier',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_category_mapping_category UNIQUE (category_id),
  CONSTRAINT fk_category_mapping_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_category_mapping_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  INDEX idx_category_mapping_department_active (department_id, is_active)
) ENGINE=InnoDB;

INSERT INTO departments (id, code, name) VALUES
  ('20000000-0000-4000-8000-000000000001', 'ENV_SOLID_WASTE', 'Environment & Solid Waste Management Branch'),
  ('20000000-0000-4000-8000-000000000002', 'PLANNING', 'Planning Branch'),
  ('20000000-0000-4000-8000-000000000003', 'REVENUE', 'Revenue Branch')
AS incoming
ON DUPLICATE KEY UPDATE name = incoming.name;

INSERT INTO categories (id, code, name) VALUES
  ('30000000-0000-4000-8000-000000000001', 'LAND', 'Land'),
  ('30000000-0000-4000-8000-000000000002', 'ENVIRONMENT', 'Environment'),
  ('30000000-0000-4000-8000-000000000003', 'SOLID_WASTE', 'Solid Waste Management'),
  ('30000000-0000-4000-8000-000000000004', 'STREET_PUBLIC_LIGHTING', 'Street/Public Lighting'),
  ('30000000-0000-4000-8000-000000000005', 'BUILDING', 'Building'),
  ('30000000-0000-4000-8000-000000000006', 'OTHER_NUISANCE', 'Other/Nuisance')
AS incoming
ON DUPLICATE KEY UPDATE name = incoming.name;

-- Only mappings confirmed in the project brief are seeded.
INSERT INTO category_department_mappings (id, category_id, department_id) VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001')
AS incoming
ON DUPLICATE KEY UPDATE department_id = incoming.department_id, is_active = TRUE;

INSERT IGNORE INTO schema_migrations (version) VALUES ('002_department_schema');

