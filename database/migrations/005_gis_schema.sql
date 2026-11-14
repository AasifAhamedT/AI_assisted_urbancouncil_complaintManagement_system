USE gis_db;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaint_locations (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL COMMENT 'External complaint_db identifier',
  location POINT NOT NULL SRID 4326,
  address_text VARCHAR(500) NULL,
  location_description VARCHAR(500) NULL,
  accuracy_meters DECIMAL(10,2) NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'MAP_SELECTION',
  created_by_user_id CHAR(36) NOT NULL COMMENT 'External auth_db user identifier',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_complaint_locations_complaint UNIQUE (complaint_id),
  CONSTRAINT chk_location_accuracy CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
  CONSTRAINT chk_location_source CHECK (source IN ('MAP_SELECTION', 'DEVICE_GPS', 'ADMIN_CORRECTION')),
  SPATIAL INDEX spx_complaint_locations_location (location),
  INDEX idx_complaint_locations_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS geographical_areas (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  area_type VARCHAR(50) NOT NULL,
  boundary MULTIPOLYGON NOT NULL SRID 4326,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_reference VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_geographical_areas_code UNIQUE (code),
  SPATIAL INDEX spx_geographical_areas_boundary (boundary),
  INDEX idx_geographical_areas_type_active (area_type, is_active)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations (version) VALUES ('005_gis_schema');

