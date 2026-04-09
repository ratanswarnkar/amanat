CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE otp_codes
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'otp_codes'
      AND column_name = 'mobile'
  ) THEN
    EXECUTE '
      UPDATE otp_codes
      SET phone = mobile
      WHERE phone IS NULL
    ';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created_at
  ON otp_codes (phone, created_at DESC);

CREATE TABLE IF NOT EXISTS caretakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  record_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  record_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL,
  user_id UUID NOT NULL,
  quantity_total INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  refill_threshold INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT medicine_inventory_unique_medicine_user UNIQUE (medicine_id, user_id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  doctor_name TEXT NOT NULL,
  hospital_name TEXT,
  file_url TEXT NOT NULL,
  issue_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  recorded_at TIMESTAMP DEFAULT NOW()
);

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

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caretakers_user_id_fkey'
  ) THEN
    ALTER TABLE caretakers
      ADD CONSTRAINT caretakers_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'health_records_user_id_fkey'
  ) THEN
    ALTER TABLE health_records
      ADD CONSTRAINT health_records_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medicine_inventory_medicine_id_fkey'
  ) THEN
    ALTER TABLE medicine_inventory
      ADD CONSTRAINT medicine_inventory_medicine_id_fkey
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medicine_inventory_user_id_fkey'
  ) THEN
    ALTER TABLE medicine_inventory
      ADD CONSTRAINT medicine_inventory_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_user_id_fkey'
  ) THEN
    ALTER TABLE prescriptions
      ADD CONSTRAINT prescriptions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vitals_user_id_fkey'
  ) THEN
    ALTER TABLE vitals
      ADD CONSTRAINT vitals_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_caretakers_user_id ON caretakers (user_id);
CREATE INDEX IF NOT EXISTS idx_health_records_user_id ON health_records (user_id);
CREATE INDEX IF NOT EXISTS idx_health_records_record_type ON health_records (record_type);
CREATE INDEX IF NOT EXISTS idx_medicine_inventory_user_id ON medicine_inventory (user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_user_id ON prescriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_vitals_user_id_recorded_at ON vitals (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_medicines_user_id ON medicines (user_id);
CREATE INDEX IF NOT EXISTS idx_medicine_logs_user_id_created_at ON medicine_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medicine_logs_medicine_id ON medicine_logs (medicine_id);
CREATE INDEX IF NOT EXISTS idx_medicine_reminders_user_id_created_at ON medicine_reminders (user_id, created_at DESC);
