CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS security_question_catalog (
  question_key TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  display_order SMALLINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_security_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question_key TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  question_order SMALLINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_security_questions_user_id_fkey'
  ) THEN
    ALTER TABLE user_security_questions
      ADD CONSTRAINT user_security_questions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_security_questions_question_key_fkey'
  ) THEN
    ALTER TABLE user_security_questions
      ADD CONSTRAINT user_security_questions_question_key_fkey
      FOREIGN KEY (question_key) REFERENCES security_question_catalog(question_key) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_security_questions_user_question_unique'
  ) THEN
    ALTER TABLE user_security_questions
      ADD CONSTRAINT user_security_questions_user_question_unique
      UNIQUE (user_id, question_key);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_security_questions_user_order_unique'
  ) THEN
    ALTER TABLE user_security_questions
      ADD CONSTRAINT user_security_questions_user_order_unique
      UNIQUE (user_id, question_order);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_security_questions_order_check'
  ) THEN
    ALTER TABLE user_security_questions
      ADD CONSTRAINT user_security_questions_order_check
      CHECK (question_order >= 1 AND question_order <= 5);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_security_questions_user_id
  ON user_security_questions (user_id, question_order);

INSERT INTO security_question_catalog (question_key, prompt, display_order)
VALUES
  ('first_school', 'What was the name of your first school?', 1),
  ('childhood_friend', 'What is the first name of your childhood best friend?', 2),
  ('mother_birth_city', 'In which city was your mother born?', 3),
  ('first_pet', 'What was the name of your first pet?', 4),
  ('favorite_teacher', 'What was the last name of your favorite teacher?', 5)
ON CONFLICT (question_key) DO UPDATE
SET prompt = EXCLUDED.prompt,
    display_order = EXCLUDED.display_order,
    is_active = TRUE,
    updated_at = NOW();
