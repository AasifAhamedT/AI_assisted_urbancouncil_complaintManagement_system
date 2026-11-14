-- Read-only verification queries. Run only after migrations 000-006 succeed.

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

