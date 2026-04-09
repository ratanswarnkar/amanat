ALTER TABLE vault_access_grants
  ADD COLUMN IF NOT EXISTS access_scope TEXT NOT NULL DEFAULT 'read_only';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vault_access_grants_access_scope_check'
  ) THEN
    ALTER TABLE vault_access_grants
      ADD CONSTRAINT vault_access_grants_access_scope_check
      CHECK (access_scope IN ('read_only'));
  END IF;
END $$;
