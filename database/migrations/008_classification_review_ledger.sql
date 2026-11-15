USE complaint_db;

CREATE TABLE IF NOT EXISTS classification_reviews (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  recommendation_id CHAR(36) NULL,
  reviewed_by_user_id CHAR(36) NOT NULL COMMENT 'External auth_db Administrator identifier',
  decision VARCHAR(20) NOT NULL,
  previous_category_id CHAR(36) NULL COMMENT 'External department_db category identifier',
  final_category_id CHAR(36) NOT NULL COMMENT 'External department_db category identifier',
  was_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  reason VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_classification_reviews_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  CONSTRAINT fk_classification_reviews_recommendation
    FOREIGN KEY (recommendation_id) REFERENCES ai_recommendations(id) ON DELETE RESTRICT,
  CONSTRAINT chk_classification_review_decision
    CHECK (decision IN ('APPROVED', 'OVERRIDDEN', 'MANUAL')),
  CONSTRAINT chk_classification_review_override
    CHECK (was_overridden = FALSE OR CHAR_LENGTH(TRIM(reason)) > 0),
  INDEX idx_classification_reviews_complaint_time (complaint_id, created_at),
  INDEX idx_classification_reviews_reviewer_time (reviewed_by_user_id, created_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations (version) VALUES ('008_classification_review_ledger');
