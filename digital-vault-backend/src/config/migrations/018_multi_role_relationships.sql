CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE nominees
  ADD COLUMN IF NOT EXISTS nominee_user_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominees_nominee_user_id_fkey'
  ) THEN
    ALTER TABLE nominees
      ADD CONSTRAINT nominees_nominee_user_id_fkey
      FOREIGN KEY (nominee_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nominees_status_check'
  ) THEN
    ALTER TABLE nominees
      ADD CONSTRAINT nominees_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

WITH latest_verification AS (
  SELECT DISTINCT ON (nv.nominee_id, nv.user_id)
    nv.nominee_id,
    nv.user_id,
    nv.status,
    nv.verified_at
  FROM nominee_verifications nv
  ORDER BY nv.nominee_id, nv.user_id, COALESCE(nv.verified_at, nv.updated_at, nv.created_at) DESC
)
UPDATE nominees n
SET
  status = CASE
    WHEN lv.status = 'approved' THEN 'approved'
    WHEN lv.status = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  approved_at = CASE
    WHEN lv.status = 'approved' THEN COALESCE(lv.verified_at, n.approved_at)
    ELSE NULL
  END
FROM latest_verification lv
WHERE lv.nominee_id = n.id
  AND lv.user_id = n.user_id
  AND (
    n.status IS DISTINCT FROM CASE
      WHEN lv.status = 'approved' THEN 'approved'
      WHEN lv.status = 'rejected' THEN 'rejected'
      ELSE 'pending'
    END
    OR (
      lv.status = 'approved'
      AND n.approved_at IS DISTINCT FROM COALESCE(lv.verified_at, n.approved_at)
    )
    OR (
      lv.status IS DISTINCT FROM 'approved'
      AND n.approved_at IS NOT NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uniq_nominees_owner_nominee_user
  ON nominees (user_id, nominee_user_id)
  WHERE nominee_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nominees_nominee_user_id
  ON nominees (nominee_user_id);

ALTER TABLE caretakers
  ADD COLUMN IF NOT EXISTS caretaker_user_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caretakers_caretaker_user_id_fkey'
  ) THEN
    ALTER TABLE caretakers
      ADD CONSTRAINT caretakers_caretaker_user_id_fkey
      FOREIGN KEY (caretaker_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caretakers_status_check'
  ) THEN
    ALTER TABLE caretakers
      ADD CONSTRAINT caretakers_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_caretakers_owner_caretaker_user
  ON caretakers (user_id, caretaker_user_id)
  WHERE caretaker_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_caretakers_caretaker_user_id
  ON caretakers (caretaker_user_id);
