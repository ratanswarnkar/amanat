CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS medicine_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
  medicine_name TEXT NOT NULL,
  dosage TEXT,
  schedule_times JSONB NOT NULL DEFAULT '[]'::jsonb,
  repeat_type TEXT NOT NULL DEFAULT 'daily',
  custom_pattern JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medicine_schedules_repeat_type_check'
  ) THEN
    ALTER TABLE medicine_schedules
      ADD CONSTRAINT medicine_schedules_repeat_type_check
      CHECK (repeat_type IN ('daily', 'weekly', 'custom'));
  END IF;
END $$;

ALTER TABLE medicine_reminders
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES medicine_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medicine_schedules_patient_created_at
  ON medicine_schedules (patient_id, created_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_medicine_schedules_created_by
  ON medicine_schedules (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medicine_reminders_schedule_id
  ON medicine_reminders (schedule_id, status, created_at DESC);
