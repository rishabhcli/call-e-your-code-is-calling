BEGIN;

CREATE TABLE IF NOT EXISTS app_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(version) BETWEEN 1 AND 100)
);

INSERT INTO app_schema_migrations (version)
VALUES ('0001_runtime_readiness')
ON CONFLICT (version) DO NOTHING;

COMMIT;

