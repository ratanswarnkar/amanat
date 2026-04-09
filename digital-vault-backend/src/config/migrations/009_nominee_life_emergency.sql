CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS nominees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  dob DATE,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nominee_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nominee_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  security_answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  dob_verified BOOLEAN NOT NULL DEFAULT FALSE,
  image_match_score NUMERIC(5,2),
  biometric_verified BOOLEAN NOT NULL DEFAULT FALSE,
  death_cert_url TEXT,
  verified_by UUID,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS life_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed_alive',
  confirmed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'mobile_app',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS life_check_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  check_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  miss_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emergency_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trigger_reason TEXT NOT NULL,
  triggered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nominee_id UUID NOT NULL,
  trigger_id UUID NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  consumed_at TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominees_user_id_fkey'
  ) THEN
    ALTER TABLE nominees
      ADD CONSTRAINT nominees_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_verifications_nominee_id_fkey'
  ) THEN
    ALTER TABLE nominee_verifications
      ADD CONSTRAINT nominee_verifications_nominee_id_fkey
      FOREIGN KEY (nominee_id) REFERENCES nominees(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_verifications_user_id_fkey'
  ) THEN
    ALTER TABLE nominee_verifications
      ADD CONSTRAINT nominee_verifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_verifications_verified_by_fkey'
  ) THEN
    ALTER TABLE nominee_verifications
      ADD CONSTRAINT nominee_verifications_verified_by_fkey
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'life_confirmations_user_id_fkey'
  ) THEN
    ALTER TABLE life_confirmations
      ADD CONSTRAINT life_confirmations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'life_check_events_user_id_fkey'
  ) THEN
    ALTER TABLE life_check_events
      ADD CONSTRAINT life_check_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'life_check_events_user_date_unique'
  ) THEN
    ALTER TABLE life_check_events
      ADD CONSTRAINT life_check_events_user_date_unique
      UNIQUE (user_id, check_date);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emergency_triggers_user_id_fkey'
  ) THEN
    ALTER TABLE emergency_triggers
      ADD CONSTRAINT emergency_triggers_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vault_access_grants_user_id_fkey'
  ) THEN
    ALTER TABLE vault_access_grants
      ADD CONSTRAINT vault_access_grants_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vault_access_grants_nominee_id_fkey'
  ) THEN
    ALTER TABLE vault_access_grants
      ADD CONSTRAINT vault_access_grants_nominee_id_fkey
      FOREIGN KEY (nominee_id) REFERENCES nominees(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vault_access_grants_trigger_id_fkey'
  ) THEN
    ALTER TABLE vault_access_grants
      ADD CONSTRAINT vault_access_grants_trigger_id_fkey
      FOREIGN KEY (trigger_id) REFERENCES emergency_triggers(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vault_access_grants_token_unique'
  ) THEN
    ALTER TABLE vault_access_grants
      ADD CONSTRAINT vault_access_grants_token_unique
      UNIQUE (token);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_verifications_status_check'
  ) THEN
    ALTER TABLE nominee_verifications
      ADD CONSTRAINT nominee_verifications_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'requires_review'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominee_verifications_image_score_check'
  ) THEN
    ALTER TABLE nominee_verifications
      ADD CONSTRAINT nominee_verifications_image_score_check
      CHECK (image_match_score IS NULL OR (image_match_score >= 0 AND image_match_score <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'life_confirmations_status_check'
  ) THEN
    ALTER TABLE life_confirmations
      ADD CONSTRAINT life_confirmations_status_check
      CHECK (status IN ('confirmed_alive', 'missed', 'auto_marked'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'life_check_events_status_check'
  ) THEN
    ALTER TABLE life_check_events
      ADD CONSTRAINT life_check_events_status_check
      CHECK (status IN ('pending', 'confirmed', 'missed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'life_check_events_miss_count_check'
  ) THEN
    ALTER TABLE life_check_events
      ADD CONSTRAINT life_check_events_miss_count_check
      CHECK (miss_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emergency_triggers_status_check'
  ) THEN
    ALTER TABLE emergency_triggers
      ADD CONSTRAINT emergency_triggers_status_check
      CHECK (status IN ('active', 'resolved', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vault_access_grants_status_check'
  ) THEN
    ALTER TABLE vault_access_grants
      ADD CONSTRAINT vault_access_grants_status_check
      CHECK (status IN ('active', 'revoked', 'expired', 'consumed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nominees_user_id
  ON nominees (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nominees_user_active
  ON nominees (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_nominee_verifications_nominee_status
  ON nominee_verifications (nominee_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nominee_verifications_user_status
  ON nominee_verifications (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_life_confirmations_user_confirmed_at
  ON life_confirmations (user_id, confirmed_at DESC);

CREATE INDEX IF NOT EXISTS idx_life_check_events_user_check_date
  ON life_check_events (user_id, check_date DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_triggers_user_status
  ON emergency_triggers (user_id, status, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_vault_access_grants_user_status_expires
  ON vault_access_grants (user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_vault_access_grants_nominee_status_expires
  ON vault_access_grants (nominee_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_vault_access_grants_trigger_id
  ON vault_access_grants (trigger_id);
