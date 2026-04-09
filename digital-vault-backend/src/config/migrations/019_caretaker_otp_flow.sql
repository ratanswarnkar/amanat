ALTER TABLE caretakers
  ADD COLUMN IF NOT EXISTS otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caretakers_otp_attempts_check'
  ) THEN
    ALTER TABLE caretakers
      ADD CONSTRAINT caretakers_otp_attempts_check
      CHECK (otp_attempts >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_caretakers_user_status_created_at
  ON caretakers (user_id, status, created_at DESC);

