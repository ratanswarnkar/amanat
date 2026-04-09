CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE otp_codes
  ALTER COLUMN otp TYPE TEXT;

ALTER TABLE otp_codes
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_refresh_token_hash
  ON auth_sessions (refresh_token_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
  ON auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
  ON auth_sessions (expires_at);
