ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('user', 'admin', 'nominee'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users (LOWER(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_is_blocked
  ON users (is_blocked);
