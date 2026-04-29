-- ============================================================
-- init.sql — Development bootstrap
-- Runs schema + demo seed data together.
-- FOR PRODUCTION: docker-compose mounts schema.sql only.
--                 First tenant created via /setup wizard.
-- ============================================================
\i /docker-entrypoint-initdb.d/schema.sql
\i /docker-entrypoint-initdb.d/seed.demo.sql
