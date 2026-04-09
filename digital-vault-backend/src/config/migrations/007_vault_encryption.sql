ALTER TABLE vault_files
  ADD COLUMN IF NOT EXISTS encryption_key_id TEXT,
  ADD COLUMN IF NOT EXISTS iv TEXT,
  ADD COLUMN IF NOT EXISTS auth_tag TEXT;

UPDATE vault_files
SET encryption_key_id = COALESCE(encryption_key_id, 'legacy'),
    iv = COALESCE(iv, ''),
    auth_tag = COALESCE(auth_tag, '')
WHERE encryption_key_id IS NULL
   OR iv IS NULL
   OR auth_tag IS NULL;
