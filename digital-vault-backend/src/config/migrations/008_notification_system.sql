CREATE TABLE IF NOT EXISTS user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT,
  app_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_device_tokens_token_key'
  ) THEN
    ALTER TABLE user_device_tokens
      ADD CONSTRAINT user_device_tokens_token_key UNIQUE (token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id
  ON user_device_tokens (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS reminder_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES medicine_reminders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token_id UUID NOT NULL REFERENCES user_device_tokens(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  retries INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMP,
  sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_notifications_unique_delivery
  ON reminder_notifications (reminder_id, device_token_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_reminder_notifications_retry
  ON reminder_notifications (status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_reminder_notifications_user_created
  ON reminder_notifications (user_id, created_at DESC);
