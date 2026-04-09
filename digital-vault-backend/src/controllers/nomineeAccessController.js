const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const { sendError, sendOk } = require('../utils/http');
const {
  createOtpCode,
  findLatestOtpCodeByPhone,
  incrementOtpAttempts,
  deleteOtpCodesByPhone,
  deleteExpiredOtpCodes,
  findUserByMobile,
  createUserWithRoleMobile,
  setUserMobileVerified,
} = require('../models/authModel');
const { getApprovedNomineeLinksByPhone } = require('../models/nomineeModel');
const { getUserSecurityQuestions } = require('../models/securityQuestionModel');
const {
  getActiveEmergencyTriggerByUserId,
  createOrReuseVaultAccessGrant,
  getActiveGrantByNomineeClaims,
} = require('../models/emergencyModel');
const { getVaultFilesByUserId } = require('../models/vaultFileModel');
const {
  getNomineeAccessChallenge,
  upsertNomineeAccessChallenge,
  recordNomineeChallengeFailure,
  markNomineeChallengeCompleted,
  createNomineeAccessAuditLog,
} = require('../models/nomineeAccessModel');
const { generateOtp, sendOtpSms } = require('../services/otpService');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);
const OTP_RESEND_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 60);
const ACCESS_GRANT_HOURS = 24;
const CHALLENGE_TOKEN_EXPIRES_IN = '15m';
const CHALLENGE_WINDOW_MINUTES = 15;
const REQUIRED_CHALLENGE_QUESTIONS = 3;
const REQUIRED_CORRECT_ANSWERS = 2;
const MAX_SECURITY_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

const normalizeIndianMobile = (value = '') => String(value || '').replace(/\D/g, '').slice(-10);
const normalizeAnswer = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const isValidPhone = (value) => /^\d{10}$/.test(value || '');

const shuffle = (items) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[targetIndex]] = [result[targetIndex], result[index]];
  }
  return result;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error('JWT_SECRET is missing');
    error.statusCode = 500;
    throw error;
  }
  return secret;
};

const signNomineeChallengeToken = ({ nomineeUserId, phone }) =>
  jwt.sign(
    {
      sub: nomineeUserId,
      userId: nomineeUserId,
      role: 'nominee',
      type: 'nominee_challenge',
      mobile: phone,
      phone,
    },
    getJwtSecret(),
    { expiresIn: CHALLENGE_TOKEN_EXPIRES_IN }
  );

const verifyNomineeChallengeToken = (token) => {
  const decoded = jwt.verify(String(token || '').trim(), getJwtSecret());
  if (decoded?.type !== 'nominee_challenge' || decoded?.role !== 'nominee') {
    const error = new Error('Invalid nominee challenge token');
    error.statusCode = 401;
    throw error;
  }
  return decoded;
};

const signNomineeAccessToken = ({ grant, nomineeUserId, phone }) => {
  const grantExpiry = new Date(grant.expires_at);
  const secondsToExpiry = Math.max(1, Math.floor((grantExpiry.getTime() - Date.now()) / 1000));

  return jwt.sign(
    {
      sub: nomineeUserId,
      userId: nomineeUserId,
      role: 'nominee',
      type: 'access',
      mobile: phone,
      phone,
      nomineeAccess: {
        grantId: grant.id,
        ownerUserId: grant.user_id,
        nomineeId: grant.nominee_id,
        accessScope: grant.access_scope || 'read_only',
        expiresAt: grant.expires_at,
      },
    },
    getJwtSecret(),
    { expiresIn: secondsToExpiry }
  );
};

const buildLinkSummary = async (link) => {
  const [activeTrigger, ownerQuestions] = await Promise.all([
    getActiveEmergencyTriggerByUserId(link.owner_user_id),
    getUserSecurityQuestions(link.owner_user_id),
  ]);

  return {
    nominee_id: link.nominee_id,
    nominee_name: link.nominee_name,
    relationship: link.relationship,
    owner_user_id: link.owner_user_id,
    owner_name: link.owner_name || 'Amanat User',
    owner_phone_masked: link.owner_mobile ? `******${String(link.owner_mobile).slice(-4)}` : null,
    emergency_active: Boolean(activeTrigger),
    has_security_questions: ownerQuestions.length >= REQUIRED_CHALLENGE_QUESTIONS,
  };
};

const buildNomineePayload = async ({ grant, nomineeUserId, phone }) => {
  const ownerFiles = await getVaultFilesByUserId(grant.user_id);

  return {
    message: 'Nominee access granted',
    token: signNomineeAccessToken({ grant, nomineeUserId, phone }),
    refreshToken: null,
    user: {
      id: nomineeUserId,
      phone,
      role: 'nominee',
      hasSecurityQuestions: true,
    },
    grant: {
      id: grant.id,
      owner_user_id: grant.user_id,
      nominee_id: grant.nominee_id,
      nominee_name: grant.nominee_name,
      expires_at: grant.expires_at,
      access_scope: grant.access_scope || 'read_only',
      file_count: ownerFiles.length,
    },
  };
};

const resolveNomineeAccount = async (phone) => {
  const existingUser = await findUserByMobile(phone);

  if (existingUser && existingUser.role !== 'nominee') {
    const error = new Error('This phone number is already used by an owner account. Use a separate nominee account.');
    error.statusCode = 409;
    throw error;
  }

  if (existingUser) {
    if (!existingUser.is_mobile_verified) {
      await setUserMobileVerified(phone);
      return {
        ...existingUser,
        is_mobile_verified: true,
      };
    }
    return existingUser;
  }

  return createUserWithRoleMobile({
    id: uuidv4(),
    mobile: phone,
    role: 'nominee',
  });
};

const sendNomineeAccessOtp = async (req, res) => {
  try {
    console.log('NOMINEE LOGIN HIT');
    await deleteExpiredOtpCodes();

    const phone = normalizeIndianMobile(req.body?.phone || '');
    if (!isValidPhone(phone)) {
      return sendError(res, 400, 'Valid 10-digit nominee phone is required');
    }

    const links = await getApprovedNomineeLinksByPhone(phone);
    if (links.length === 0) {
      await createNomineeAccessAuditLog({
        actorType: 'nominee',
        action: 'send_otp_denied',
        details: { phone },
      });
      return sendError(res, 404, 'Nominee not approved for access with this phone number.');
    }

    const latestOtp = await findLatestOtpCodeByPhone(phone);
    if (latestOtp?.created_at) {
      const waitMs = OTP_RESEND_SECONDS * 1000 - (Date.now() - new Date(latestOtp.created_at).getTime());
      if (waitMs > 0) {
        return sendError(res, 429, `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another OTP`);
      }
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await createOtpCode({
      phone,
      otp: otpHash,
      expiresAt,
    });

    await sendOtpSms({ mobile: phone, otp });

    await createNomineeAccessAuditLog({
      actorType: 'nominee',
      action: 'send_otp',
      details: {
        phone,
        linked_nominee_count: links.length,
      },
    });

    return sendOk(res, {
      message: 'Nominee OTP sent successfully',
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      linkedNomineeCount: links.length,
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Failed to send nominee OTP');
  }
};

const verifyNomineeAccessOtp = async (req, res) => {
  try {
    console.log('NOMINEE LOGIN HIT');
    const phone = normalizeIndianMobile(req.body?.phone || '');
    const otp = String(req.body?.otp || '').trim();

    if (!isValidPhone(phone)) {
      return sendError(res, 400, 'Valid 10-digit nominee phone is required');
    }

    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp)) {
      return sendError(res, 400, 'OTP must be exactly 6 digits');
    }

    const latestOtp = await findLatestOtpCodeByPhone(phone);
    if (!latestOtp?.otp || !latestOtp?.expires_at) {
      return sendError(res, 401, 'OTP not found. Please request a new OTP.');
    }

    if (new Date(latestOtp.expires_at).getTime() <= Date.now()) {
      return sendError(res, 401, 'OTP expired. Please request a new OTP.');
    }

    const isOtpValid = await bcrypt.compare(otp, latestOtp.otp);
    if (!isOtpValid) {
      await incrementOtpAttempts(latestOtp.id);
      await createNomineeAccessAuditLog({
        actorType: 'nominee',
        action: 'verify_otp_failed',
        details: { phone },
      });
      return sendError(res, 401, 'Invalid OTP');
    }

    await deleteOtpCodesByPhone(phone);

    const nomineeUser = await resolveNomineeAccount(phone);
    const links = await getApprovedNomineeLinksByPhone(phone);
    if (links.length === 0) {
      await createNomineeAccessAuditLog({
        nomineeUserId: nomineeUser.id,
        actorType: 'nominee',
        action: 'verify_otp_no_links',
        details: { phone },
      });
      return sendError(res, 404, 'Nominee not approved for access with this phone number.');
    }

    const nominees = await Promise.all(links.map((link) => buildLinkSummary(link)));
    const challengeToken = signNomineeChallengeToken({ nomineeUserId: nomineeUser.id, phone });

    await createNomineeAccessAuditLog({
      nomineeUserId: nomineeUser.id,
      actorType: 'nominee',
      action: 'verify_otp_success',
      details: {
        phone,
        linked_nominee_count: nominees.length,
      },
    });

    return sendOk(res, {
      message: 'Nominee OTP verified successfully',
      challenge_token: challengeToken,
      nominees,
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Failed to verify nominee OTP');
  }
};

const loadNomineeAccessChallenge = async (req, res) => {
  try {
    const challengeToken = String(req.body?.challenge_token || '').trim();
    const nomineeId = String(req.body?.nominee_id || '').trim();

    if (!challengeToken) {
      return sendError(res, 400, 'challenge_token is required');
    }

    if (!nomineeId) {
      return sendError(res, 400, 'nominee_id is required');
    }

    const challengeClaims = verifyNomineeChallengeToken(challengeToken);
    const phone = normalizeIndianMobile(challengeClaims.mobile || challengeClaims.phone || '');
    const nomineeLinks = await getApprovedNomineeLinksByPhone(phone);
    const selectedLink = nomineeLinks.find((item) => item.nominee_id === nomineeId);

    if (!selectedLink) {
      await createNomineeAccessAuditLog({
        nomineeUserId: challengeClaims.userId,
        actorType: 'nominee',
        action: 'challenge_denied_link_mismatch',
        details: { phone, nominee_id: nomineeId },
      });
      return sendError(res, 404, 'Nominee link not found for this account.');
    }

    const activeTrigger = await getActiveEmergencyTriggerByUserId(selectedLink.owner_user_id);
    if (!activeTrigger) {
      await createNomineeAccessAuditLog({
        nomineeUserId: challengeClaims.userId,
        nomineeId,
        ownerUserId: selectedLink.owner_user_id,
        actorType: 'nominee',
        action: 'challenge_denied_no_emergency',
        details: { phone },
      });
      return sendError(res, 403, 'Emergency mode is not active for this owner yet.');
    }

    const savedQuestions = await getUserSecurityQuestions(selectedLink.owner_user_id);
    if (savedQuestions.length < REQUIRED_CHALLENGE_QUESTIONS) {
      await createNomineeAccessAuditLog({
        nomineeUserId: challengeClaims.userId,
        nomineeId,
        ownerUserId: selectedLink.owner_user_id,
        actorType: 'nominee',
        action: 'challenge_denied_missing_questions',
        details: { phone },
      });
      return sendError(res, 400, 'The owner has not configured enough security questions.');
    }

    const accessChallenge = await upsertNomineeAccessChallenge({
      nomineeUserId: challengeClaims.userId,
      nomineeId,
      ownerUserId: selectedLink.owner_user_id,
      challengeExpiresAt: new Date(Date.now() + CHALLENGE_WINDOW_MINUTES * 60 * 1000),
    });

    if (accessChallenge?.locked_until && new Date(accessChallenge.locked_until).getTime() > Date.now()) {
      return sendError(res, 423, 'Security questions are temporarily locked. Try again later.', {
        locked_until: accessChallenge.locked_until,
      });
    }

    const questions = shuffle(savedQuestions)
      .slice(0, REQUIRED_CHALLENGE_QUESTIONS)
      .map((item) => ({
        question_key: item.question_key,
        prompt: item.prompt,
      }));

    await createNomineeAccessAuditLog({
      nomineeUserId: challengeClaims.userId,
      nomineeId,
      ownerUserId: selectedLink.owner_user_id,
      actorType: 'nominee',
      action: 'challenge_loaded',
      details: {
        phone,
        question_keys: questions.map((item) => item.question_key),
      },
    });

    return sendOk(res, {
      message: 'Owner security questions loaded',
      nominee_id: nomineeId,
      owner_name: selectedLink.owner_name || 'Amanat User',
      emergency_trigger_id: activeTrigger.id,
      questions,
      required_correct_answers: REQUIRED_CORRECT_ANSWERS,
      total_questions: questions.length,
      locked_until: accessChallenge?.locked_until || null,
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Failed to load nominee access challenge');
  }
};

const verifyNomineeSecurityAnswers = async (req, res) => {
  try {
    const challengeToken = String(req.body?.challenge_token || '').trim();
    const nomineeId = String(req.body?.nominee_id || '').trim();
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

    if (!challengeToken) {
      return sendError(res, 400, 'challenge_token is required');
    }

    if (!nomineeId) {
      return sendError(res, 400, 'nominee_id is required');
    }

    if (answers.length !== REQUIRED_CHALLENGE_QUESTIONS) {
      return sendError(res, 400, 'Exactly 3 security question answers are required.');
    }

    const challengeClaims = verifyNomineeChallengeToken(challengeToken);
    const phone = normalizeIndianMobile(challengeClaims.mobile || challengeClaims.phone || '');
    const nomineeLinks = await getApprovedNomineeLinksByPhone(phone);
    const selectedLink = nomineeLinks.find((item) => item.nominee_id === nomineeId);

    if (!selectedLink) {
      return sendError(res, 404, 'Nominee link not found for this account.');
    }

    const activeTrigger = await getActiveEmergencyTriggerByUserId(selectedLink.owner_user_id);
    if (!activeTrigger) {
      await createNomineeAccessAuditLog({
        nomineeUserId: challengeClaims.userId,
        nomineeId,
        ownerUserId: selectedLink.owner_user_id,
        actorType: 'nominee',
        action: 'verify_security_denied_no_emergency',
        details: { phone },
      });
      return sendError(res, 403, 'Emergency mode is not active for this owner yet.');
    }

    const accessChallenge = await getNomineeAccessChallenge({
      nomineeUserId: challengeClaims.userId,
      nomineeId,
      ownerUserId: selectedLink.owner_user_id,
    });

    if (!accessChallenge) {
      return sendError(res, 400, 'Load the security question challenge first.');
    }

    if (new Date(accessChallenge.challenge_expires_at).getTime() <= Date.now()) {
      return sendError(res, 401, 'Security question challenge expired. Load a new challenge.');
    }

    if (accessChallenge.locked_until && new Date(accessChallenge.locked_until).getTime() > Date.now()) {
      return sendError(res, 423, 'Too many failed attempts. Security questions are locked for 30 minutes.', {
        locked_until: accessChallenge.locked_until,
      });
    }

    const savedQuestions = await getUserSecurityQuestions(selectedLink.owner_user_id);
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
      await markNomineeChallengeCompleted({
        nomineeUserId: challengeClaims.userId,
        nomineeId,
        ownerUserId: selectedLink.owner_user_id,
      });

      const grant = await createOrReuseVaultAccessGrant({
        userId: selectedLink.owner_user_id,
        nomineeId,
        triggerId: activeTrigger.id,
        expiresAt: new Date(Date.now() + ACCESS_GRANT_HOURS * 60 * 60 * 1000),
      });

      await createNomineeAccessAuditLog({
        nomineeUserId: challengeClaims.userId,
        nomineeId,
        ownerUserId: selectedLink.owner_user_id,
        actorType: 'nominee',
        action: 'access_granted',
        details: {
          correct_answers: correctCount,
          grant_id: grant.id,
          expires_at: grant.expires_at,
        },
      });

      const payload = await buildNomineePayload({
        grant: {
          ...grant,
          nominee_name: selectedLink.nominee_name,
        },
        nomineeUserId: challengeClaims.userId,
        phone,
      });

      return sendOk(res, payload);
    }

    const hasExpiredLock = Boolean(accessChallenge.locked_until)
      && new Date(accessChallenge.locked_until).getTime() <= Date.now();
    const previousAttempts = hasExpiredLock ? 0 : Number(accessChallenge.question_attempts || 0);
    const nextAttempts = previousAttempts + 1;
    const shouldLock = nextAttempts >= MAX_SECURITY_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
      : null;

    await recordNomineeChallengeFailure({
      nomineeUserId: challengeClaims.userId,
      nomineeId,
      ownerUserId: selectedLink.owner_user_id,
      attempts: nextAttempts,
      lockedUntil,
    });

    await createNomineeAccessAuditLog({
      nomineeUserId: challengeClaims.userId,
      nomineeId,
      ownerUserId: selectedLink.owner_user_id,
      actorType: 'nominee',
      action: shouldLock ? 'security_questions_locked' : 'security_questions_failed',
      details: {
        correct_answers: correctCount,
        attempts: nextAttempts,
        locked_until: lockedUntil ? lockedUntil.toISOString() : null,
      },
    });

    return sendError(
      res,
      shouldLock ? 423 : 401,
      shouldLock
        ? 'Too many failed attempts. Security questions are locked for 30 minutes.'
        : 'Security question verification failed.',
      {
        correct_answers: correctCount,
        attempts_remaining: shouldLock ? 0 : MAX_SECURITY_ATTEMPTS - nextAttempts,
        locked_until: lockedUntil ? lockedUntil.toISOString() : null,
      }
    );
  } catch (error) {
    return sendError(res, error.statusCode || 400, error.message || 'Failed to verify security questions');
  }
};

const getNomineeAccessStatus = async (req, res) => {
  try {
    const nomineeAccess = req.user?.nomineeAccess;
    if (!nomineeAccess?.grantId) {
      return sendError(res, 403, 'Nominee access session required');
    }

    const grant = await getActiveGrantByNomineeClaims({
      grantId: nomineeAccess.grantId,
      ownerUserId: nomineeAccess.ownerUserId,
      nomineeId: nomineeAccess.nomineeId,
    });

    if (!grant) {
      return sendError(res, 401, 'Nominee access session expired');
    }

    const ownerFiles = await getVaultFilesByUserId(grant.user_id);

    return sendOk(res, {
      message: 'Nominee access status fetched successfully',
      emergency_active: true,
      grant: {
        id: grant.id,
        owner_user_id: grant.user_id,
        nominee_id: grant.nominee_id,
        nominee_name: grant.nominee_name,
        expires_at: grant.expires_at,
        access_scope: grant.access_scope || 'read_only',
        file_count: ownerFiles.length,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch nominee access status');
  }
};

const getNomineeAccessFiles = async (req, res) => {
  try {
    const nomineeAccess = req.user?.nomineeAccess;
    if (!nomineeAccess?.grantId) {
      return sendError(res, 403, 'Nominee access session required');
    }

    const grant = await getActiveGrantByNomineeClaims({
      grantId: nomineeAccess.grantId,
      ownerUserId: nomineeAccess.ownerUserId,
      nomineeId: nomineeAccess.nomineeId,
    });

    if (!grant) {
      return sendError(res, 401, 'Nominee access session expired');
    }

    const files = await getVaultFilesByUserId(grant.user_id);

    await createNomineeAccessAuditLog({
      nomineeUserId: req.user?.userId || req.user?.sub || null,
      nomineeId: grant.nominee_id,
      ownerUserId: grant.user_id,
      actorType: 'nominee',
      action: 'files_viewed',
      details: {
        file_count: files.length,
        grant_id: grant.id,
      },
    });

    return sendOk(res, {
      message: 'Nominee files fetched successfully',
      data: files.map((file) => ({
        ...file,
        access_scope: 'nominee_emergency',
        read_only: true,
      })),
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch nominee files');
  }
};

module.exports = {
  sendNomineeAccessOtp,
  verifyNomineeAccessOtp,
  loadNomineeAccessChallenge,
  verifyNomineeSecurityAnswers,
  getNomineeAccessStatus,
  getNomineeAccessFiles,
};
