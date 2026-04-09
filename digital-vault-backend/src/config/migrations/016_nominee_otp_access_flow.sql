CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS nominee_access_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nominee_user_id UUID NOT NULL,
  nominee_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  challenge_expires_at TIMESTAMP NOT NULL,
  question_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP,
  last_failed_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nominee_access_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nominee_user_id UUID,
  nominee_id UUID,
  owner_user_id UUID,
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_access_challenges_nominee_user_id_fkey'
  ) THEN
    ALTER TABLE nominee_access_challenges
      ADD CONSTRAINT nominee_access_challenges_nominee_user_id_fkey
      FOREIGN KEY (nominee_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_access_challenges_nominee_id_fkey'
  ) THEN
    ALTER TABLE nominee_access_challenges
      ADD CONSTRAINT nominee_access_challenges_nominee_id_fkey
      FOREIGN KEY (nominee_id) REFERENCES nominees(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_access_challenges_owner_user_id_fkey'
  ) THEN
    ALTER TABLE nominee_access_challenges
      ADD CONSTRAINT nominee_access_challenges_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_access_challenges_unique_link'
  ) THEN
    ALTER TABLE nominee_access_challenges
      ADD CONSTRAINT nominee_access_challenges_unique_link
      UNIQUE (nominee_user_id, nominee_id, owner_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_access_challenges_attempts_check'
  ) THEN
    ALTER TABLE nominee_access_challenges
      ADD CONSTRAINT nominee_access_challenges_attempts_check
      CHECK (question_attempts >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_access_audit_logs_nominee_user_id_fkey'
  ) THEN
    ALTER TABLE nominee_access_audit_logs
      ADD CONSTRAINT nominee_access_audit_logs_nominee_user_id_fkey
      FOREIGN KEY (nominee_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_access_audit_logs_nominee_id_fkey'
  ) THEN
    ALTER TABLE nominee_access_audit_logs
      ADD CONSTRAINT nominee_access_audit_logs_nominee_id_fkey
      FOREIGN KEY (nominee_id) REFERENCES nominees(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_access_audit_logs_owner_user_id_fkey'
  ) THEN
    ALTER TABLE nominee_access_audit_logs
      ADD CONSTRAINT nominee_access_audit_logs_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_access_audit_logs_actor_type_check'
  ) THEN
    ALTER TABLE nominee_access_audit_logs
      ADD CONSTRAINT nominee_access_audit_logs_actor_type_check
      CHECK (actor_type IN ('system', 'nominee', 'owner', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nominee_access_challenges_nominee_user
  ON nominee_access_challenges (nominee_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_nominee_access_audit_logs_nominee_user
  ON nominee_access_audit_logs (nominee_user_id, created_at DESC);
