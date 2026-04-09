ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS password;

ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_mobile_verified BOOLEAN DEFAULT false;

ALTER TABLE users ALTER COLUMN mobile SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_mobile_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_mobile_unique UNIQUE (mobile);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY,
  mobile VARCHAR(20) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
