CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_life_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  confirmation_interval_days INTEGER NOT NULL DEFAULT 7,
  admin_override_state TEXT,
  admin_override_until TIMESTAMP,
  admin_override_reason TEXT,
  admin_override_by UUID,
  admin_override_at TIMESTAMP,
  last_evaluated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS life_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  actor_user_id UUID,
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_life_settings_user_id_fkey'
  ) THEN
    ALTER TABLE user_life_settings
      ADD CONSTRAINT user_life_settings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_life_settings_admin_override_by_fkey'
  ) THEN
    ALTER TABLE user_life_settings
      ADD CONSTRAINT user_life_settings_admin_override_by_fkey
      FOREIGN KEY (admin_override_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'life_audit_logs_target_user_id_fkey'
  ) THEN
    ALTER TABLE life_audit_logs
      ADD CONSTRAINT life_audit_logs_target_user_id_fkey
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'life_audit_logs_actor_user_id_fkey'
  ) THEN
    ALTER TABLE life_audit_logs
      ADD CONSTRAINT life_audit_logs_actor_user_id_fkey
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_life_settings_interval_check'
  ) THEN
    ALTER TABLE user_life_settings
      ADD CONSTRAINT user_life_settings_interval_check
      CHECK (confirmation_interval_days BETWEEN 1 AND 365);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_life_settings_override_state_check'
  ) THEN
    ALTER TABLE user_life_settings
      ADD CONSTRAINT user_life_settings_override_state_check
      CHECK (admin_override_state IS NULL OR admin_override_state IN ('active', 'inactive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'life_audit_logs_actor_type_check'
  ) THEN
    ALTER TABLE life_audit_logs
      ADD CONSTRAINT life_audit_logs_actor_type_check
      CHECK (actor_type IN ('system', 'user', 'admin'));
  END IF;
END $$;

INSERT INTO user_life_settings (user_id)
SELECT id
FROM users
ON CONFLICT (user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_user_life_settings_user_id
  ON user_life_settings (user_id);

CREATE INDEX IF NOT EXISTS idx_life_audit_logs_target_user_created
  ON life_audit_logs (target_user_id, created_at DESC);
