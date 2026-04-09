DROP TABLE IF EXISTS otp_codes;

CREATE TABLE otp_codes (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created_at
  ON otp_codes (phone, created_at DESC);
