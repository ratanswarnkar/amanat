const pool = require('../config/db');

const getActiveSecurityQuestionCatalog = async () => {
  const { rows } = await pool.query(
    `
      SELECT question_key, prompt, display_order
      FROM security_question_catalog
      WHERE is_active = TRUE
      ORDER BY display_order ASC
    `
  );

  return rows;
};

const getUserSecurityQuestions = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT
        usq.id,
        usq.user_id,
        usq.question_key,
        sqc.prompt,
        usq.answer_hash,
        usq.question_order,
        usq.created_at,
        usq.updated_at
      FROM user_security_questions usq
      INNER JOIN security_question_catalog sqc
        ON sqc.question_key = usq.question_key
      WHERE usq.user_id = $1::uuid
      ORDER BY usq.question_order ASC
    `,
    [userId]
  );

  return rows;
};

const hasUserSecurityQuestions = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM user_security_questions
      WHERE user_id = $1::uuid
    `,
    [userId]
  );

  return Number(rows[0]?.total || 0) >= 3;
};

const replaceUserSecurityQuestions = async ({ userId, questions }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_security_questions WHERE user_id = $1::uuid', [userId]);

    for (const question of questions) {
      await client.query(
        `
          INSERT INTO user_security_questions (
            user_id,
            question_key,
            answer_hash,
            question_order
          )
          VALUES ($1::uuid, $2::text, $3::text, $4::smallint)
        `,
        [userId, question.question_key, question.answer_hash, question.question_order]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getUserSecurityQuestions(userId);
};

module.exports = {
  getActiveSecurityQuestionCatalog,
  getUserSecurityQuestions,
  hasUserSecurityQuestions,
  replaceUserSecurityQuestions,
};
