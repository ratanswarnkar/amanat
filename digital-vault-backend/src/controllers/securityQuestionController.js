const bcrypt = require('bcrypt');

const { sendError, sendOk } = require('../utils/http');
const {
  getActiveSecurityQuestionCatalog,
  getUserSecurityQuestions,
  replaceUserSecurityQuestions,
} = require('../models/securityQuestionModel');
const {
  getNomineeByIdForUser,
  getLatestVerificationByNominee,
  markNomineeSecurityQuestionsApproved,
  recordNomineeSecurityQuestionFailure,
} = require('../models/nomineeModel');

const MIN_SELECTED_QUESTIONS = 3;
const MAX_SELECTED_QUESTIONS = 5;
const REQUIRED_CORRECT_ANSWERS = 2;
const REQUIRED_VERIFICATION_ANSWERS = 3;
const MAX_VERIFICATION_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

const getUserId = (req) => req.user?.userId || req.user?.sub;

const normalizeAnswer = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const buildCatalogMap = (catalog) => new Map(catalog.map((item) => [item.question_key, item]));

const readVerificationMeta = (verification) => {
  const payload = verification?.security_answers_json;
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
};

const shuffle = (items) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[targetIndex]] = [result[targetIndex], result[index]];
  }
  return result;
};

const saveSecurityQuestions = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (questions.length < MIN_SELECTED_QUESTIONS || questions.length > MAX_SELECTED_QUESTIONS) {
      return sendError(res, 400, 'Select between 3 and 5 security questions.');
    }

    const catalog = await getActiveSecurityQuestionCatalog();
    const catalogMap = buildCatalogMap(catalog);
    const seen = new Set();

    const normalizedQuestions = questions.map((item, index) => {
      const questionKey = String(item?.question_key || item?.questionKey || '').trim();
      const answer = normalizeAnswer(item?.answer || '');

      if (!questionKey || !catalogMap.has(questionKey)) {
        throw new Error('One or more selected questions are invalid.');
      }

      if (seen.has(questionKey)) {
        throw new Error('Duplicate security questions are not allowed.');
      }

      if (!answer) {
        throw new Error('Every selected security question must have an answer.');
      }

      seen.add(questionKey);

      return {
        question_key: questionKey,
        normalized_answer: answer,
        question_order: index + 1,
      };
    });

    const hashedQuestions = await Promise.all(
      normalizedQuestions.map(async (question) => ({
        question_key: question.question_key,
        question_order: question.question_order,
        answer_hash: await bcrypt.hash(question.normalized_answer, 10),
      }))
    );

    const savedQuestions = await replaceUserSecurityQuestions({
      userId,
      questions: hashedQuestions,
    });

    return sendOk(res, {
      message: 'Security questions saved successfully',
      question_count: savedQuestions.length,
      hasSecurityQuestions: true,
    });
  } catch (error) {
    return sendError(res, 400, error.message || 'Failed to save security questions.');
  }
};

const getSecurityQuestionChallenge = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const nomineeId = String(req.params?.nomineeId || '').trim();
    const nominee = await getNomineeByIdForUser({ nomineeId, userId });
    if (!nominee) {
      return sendError(res, 404, 'Nominee not found');
    }

    const verification = await getLatestVerificationByNominee({ nomineeId, userId });
    if (!verification) {
      return sendError(res, 400, 'No nominee verification request found. Verify OTP first.');
    }

    const verificationMeta = readVerificationMeta(verification);
    if (!verificationMeta.otp_verified_at) {
      return sendError(res, 400, 'Security questions unlock only after OTP verification.');
    }

    const lockedUntil = verificationMeta.security_question_locked_until;
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
      return sendError(res, 423, 'Security questions are temporarily locked. Try again later.', {
        locked_until: lockedUntil,
      });
    }

    const savedQuestions = await getUserSecurityQuestions(userId);
    if (savedQuestions.length < MIN_SELECTED_QUESTIONS) {
      return sendError(res, 400, 'The user has not configured enough security questions.');
    }

    const challenge = shuffle(savedQuestions)
      .slice(0, REQUIRED_VERIFICATION_ANSWERS)
      .map((item) => ({
        question_key: item.question_key,
        prompt: item.prompt,
      }));

    return sendOk(res, {
      message: 'Security question challenge loaded',
      nominee_id: nomineeId,
      questions: challenge,
      required_correct_answers: REQUIRED_CORRECT_ANSWERS,
      total_questions: challenge.length,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to load security question challenge.');
  }
};

const verifySecurityQuestions = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const nomineeId = String(req.body?.nominee_id || '').trim();
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

    if (answers.length !== REQUIRED_VERIFICATION_ANSWERS) {
      return sendError(res, 400, 'Exactly 3 security question answers are required.');
    }

    const nominee = await getNomineeByIdForUser({ nomineeId, userId });
    if (!nominee) {
      return sendError(res, 404, 'Nominee not found');
    }

    const verification = await getLatestVerificationByNominee({ nomineeId, userId });
    if (!verification) {
      return sendError(res, 400, 'No nominee verification request found. Verify OTP first.');
    }

    const verificationMeta = readVerificationMeta(verification);
    if (!verificationMeta.otp_verified_at) {
      return sendError(res, 400, 'Verify nominee OTP before security questions.');
    }

    const lockExpiry = verificationMeta.security_question_locked_until;
    if (lockExpiry && new Date(lockExpiry).getTime() > Date.now()) {
      return sendError(res, 423, 'Too many failed attempts. Security questions are locked for 30 minutes.', {
        locked_until: lockExpiry,
      });
    }

    const savedQuestions = await getUserSecurityQuestions(userId);
    const questionMap = new Map(savedQuestions.map((item) => [item.question_key, item]));
    const submittedKeys = new Set();

    const normalizedAnswers = answers.map((item) => {
      const questionKey = String(item?.question_key || item?.questionKey || '').trim();
      const answer = normalizeAnswer(item?.answer || '');

      if (!questionKey || !questionMap.has(questionKey)) {
        throw new Error('One or more submitted security questions are invalid.');
      }

      if (submittedKeys.has(questionKey)) {
        throw new Error('Duplicate security question answers are not allowed.');
      }

      if (!answer) {
        throw new Error('Every security question must have an answer.');
      }

      submittedKeys.add(questionKey);
      return { question_key: questionKey, answer };
    });

    let correctCount = 0;
    for (const item of normalizedAnswers) {
      const stored = questionMap.get(item.question_key);
      const isMatch = await bcrypt.compare(item.answer, stored.answer_hash);
      if (isMatch) {
        correctCount += 1;
      }
    }

    if (correctCount >= REQUIRED_CORRECT_ANSWERS) {
      const approved = await markNomineeSecurityQuestionsApproved({
        verificationId: verification.id,
        userId,
        correctCount,
        questionKeys: normalizedAnswers.map((item) => item.question_key),
      });

      return sendOk(res, {
        message: 'Security questions verified successfully',
        nominee_id: nomineeId,
        verification: {
          id: approved?.id,
          status: approved?.status,
          verified_at: approved?.verified_at,
          correct_answers: correctCount,
        },
      });
    }

    const previousAttemptsRaw = Number(verificationMeta.security_question_attempts || 0);
    const hasExpiredLock = Boolean(lockExpiry) && new Date(lockExpiry).getTime() <= Date.now();
    const previousAttempts = hasExpiredLock ? 0 : previousAttemptsRaw;
    const nextAttempts = previousAttempts + 1;
    const shouldLock = nextAttempts >= MAX_VERIFICATION_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000).toISOString()
      : null;

    await recordNomineeSecurityQuestionFailure({
      verificationId: verification.id,
      userId,
      attempts: nextAttempts,
      lockedUntil,
      correctCount,
    });

    return sendError(
      res,
      shouldLock ? 423 : 401,
      shouldLock
        ? 'Too many failed attempts. Security questions are locked for 30 minutes.'
        : 'Security question verification failed.',
      {
        correct_answers: correctCount,
        attempts_remaining: shouldLock ? 0 : MAX_VERIFICATION_ATTEMPTS - nextAttempts,
        locked_until: lockedUntil,
      }
    );
  } catch (error) {
    return sendError(res, 400, error.message || 'Failed to verify security questions.');
  }
};

module.exports = {
  saveSecurityQuestions,
  getSecurityQuestionChallenge,
  verifySecurityQuestions,
};
