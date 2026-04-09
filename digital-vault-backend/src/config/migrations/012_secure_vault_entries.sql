CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES vault_entries(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_entries_user_id_updated_at
  ON vault_entries (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_vault_entries_user_id_lower_title
  ON vault_entries (user_id, lower(title));

CREATE INDEX IF NOT EXISTS idx_vault_fields_entry_id
  ON vault_fields (entry_id);

CREATE INDEX IF NOT EXISTS idx_vault_fields_lower_label
  ON vault_fields (lower(label));
