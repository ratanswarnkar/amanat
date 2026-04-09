ALTER TABLE caretakers
ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'view';

ALTER TABLE health_records
ADD COLUMN IF NOT EXISTS record_date DATE;

ALTER TABLE health_records
ADD COLUMN IF NOT EXISTS notes TEXT;
