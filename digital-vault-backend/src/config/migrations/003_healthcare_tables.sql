CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS caretakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT,
  phone TEXT,
  relationship TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID,
  user_id UUID,
  quantity_total INTEGER,
  quantity_remaining INTEGER,
  refill_threshold INTEGER,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT,
  record_type TEXT,
  file_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
