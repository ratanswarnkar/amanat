CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT 'User',
  mobile VARCHAR(20) NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  pin_hash TEXT,
  is_mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_mobile_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_mobile_unique UNIQUE (mobile);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS otp_codes (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20),
  mobile VARCHAR(20),
  otp TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created_at
  ON otp_codes (phone, created_at DESC);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  blood_group TEXT,
  emergency_contact TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT,
  times_per_day INTEGER,
  time_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL,
  user_id UUID NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT NOT NULL,
  taken_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reminder_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medicine_logs_status_check'
  ) THEN
    ALTER TABLE medicine_logs
      ADD CONSTRAINT medicine_logs_status_check
      CHECK (status IN ('pending', 'taken', 'missed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medicine_reminders_status_check'
  ) THEN
    ALTER TABLE medicine_reminders
      ADD CONSTRAINT medicine_reminders_status_check
      CHECK (status IN ('pending', 'taken', 'missed', 'completed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_fkey'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medicines_user_id_fkey'
  ) THEN
    ALTER TABLE medicines
      ADD CONSTRAINT medicines_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medicine_logs_medicine_id_fkey'
  ) THEN
    ALTER TABLE medicine_logs
      ADD CONSTRAINT medicine_logs_medicine_id_fkey
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medicine_logs_user_id_fkey'
  ) THEN
    ALTER TABLE medicine_logs
      ADD CONSTRAINT medicine_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medicine_reminders_medicine_id_fkey'
  ) THEN
    ALTER TABLE medicine_reminders
      ADD CONSTRAINT medicine_reminders_medicine_id_fkey
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medicine_reminders_user_id_fkey'
  ) THEN
    ALTER TABLE medicine_reminders
      ADD CONSTRAINT medicine_reminders_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_mobile ON users (mobile);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_medicines_user_id ON medicines (user_id);
CREATE INDEX IF NOT EXISTS idx_medicine_logs_user_id_created_at ON medicine_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medicine_reminders_user_id_created_at ON medicine_reminders (user_id, created_at DESC);
