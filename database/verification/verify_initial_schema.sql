-- Read-only verification queries. Run only after migrations 000-010 succeed.

SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN (
  'auth_db',
  'complaint_db',
  'department_db',
  'notification_db',
  'gis_db',
  'reporting_db'
)
ORDER BY schema_name;

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN (
  'auth_db',
  'complaint_db',
  'department_db',
  'notification_db',
  'gis_db',
  'reporting_db'
)
ORDER BY table_schema, table_name;

SELECT code, display_name FROM auth_db.roles ORDER BY code;
SELECT code, name, is_active FROM department_db.departments ORDER BY code;
SELECT code, name, is_active FROM department_db.categories ORDER BY code;

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE constraint_schema = 'department_db'
  AND table_name = 'department_account_mappings'
  AND constraint_name IN ('uq_department_account_user', 'uq_department_account_department')
ORDER BY constraint_name;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'complaint_db'
  AND table_name IN ('ai_recommendations', 'classification_reviews')
ORDER BY table_name;

SELECT column_name, extra
FROM information_schema.columns
WHERE table_schema = 'complaint_db'
  AND table_name = 'reassignment_requests'
  AND column_name IN ('approved_department_id', 'pending_complaint_id')
ORDER BY column_name;

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE constraint_schema = 'complaint_db'
  AND table_name = 'reassignment_requests'
  AND constraint_name = 'uq_reassignment_pending_complaint';

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'notification_db'
  AND table_name = 'notifications'
  AND column_name = 'deduplication_key';

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE constraint_schema = 'notification_db'
  AND table_name = 'notifications'
  AND constraint_name = 'uq_notifications_deduplication_key';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'notification_db'
  AND table_name = 'notification_dispatch_failures';

SELECT
  c.name AS category_name,
  d.name AS department_name,
  m.is_active
FROM department_db.category_department_mappings AS m
JOIN department_db.categories AS c ON c.id = m.category_id
JOIN department_db.departments AS d ON d.id = m.department_id
ORDER BY c.name;

SELECT table_schema, version, applied_at
FROM (
  SELECT 'auth_db' AS table_schema, version, applied_at FROM auth_db.schema_migrations
  UNION ALL
  SELECT 'department_db', version, applied_at FROM department_db.schema_migrations
  UNION ALL
  SELECT 'complaint_db', version, applied_at FROM complaint_db.schema_migrations
  UNION ALL
  SELECT 'notification_db', version, applied_at FROM notification_db.schema_migrations
  UNION ALL
  SELECT 'gis_db', version, applied_at FROM gis_db.schema_migrations
  UNION ALL
  SELECT 'reporting_db', version, applied_at FROM reporting_db.schema_migrations
) AS migrations
ORDER BY table_schema, version;

