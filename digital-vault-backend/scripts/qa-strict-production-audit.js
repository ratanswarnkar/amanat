/* global __dirname */
/* eslint-disable no-console */
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
process.env.DISABLE_BACKGROUND_JOBS = 'true';

const app = require('../src/app');
const pool = require('../src/config/db');

const OTP = '123456';
const PIN = '1234';

const normalizeMobile = (value) => String(value || '').replace(/\D/g, '').slice(-10);
const createMobile = (prefix, seed) => normalizeMobile(`9${prefix}${String(seed).padStart(8, '0')}`);
const nowMs = () => Date.now();

const state = {
  checks: [],
  failures: [],
  metrics: [],
};

const recordCheck = (name, passed, details = {}) => {
  const entry = { name, passed, ...details };
  state.checks.push(entry);
  if (!passed) {
    state.failures.push(entry);
  }
};

const timed = async (name, fn) => {
  const start = nowMs();
  const result = await fn();
  const elapsedMs = nowMs() - start;
  state.metrics.push({ name, elapsedMs });
  return result;
};

const assertStatus = (response, expected, label) => {
  const passed = response.status === expected;
  recordCheck(label, passed, {
    expected,
    actual: response.status,
    response: response.data,
  });
  return passed;
};

const forceOtp = async (mobile, otp = OTP) => {
  const hash = await bcrypt.hash(String(otp), 10);
  await pool.query(
    `
      UPDATE otp_codes
      SET otp = $2::text,
          expires_at = NOW() + INTERVAL '5 minutes',
          verified = FALSE,
          attempts = 0
      WHERE id = (
        SELECT id
        FROM otp_codes
        WHERE phone = $1::text
        ORDER BY created_at DESC
        LIMIT 1
      )
    `,
    [mobile, hash]
  );
};

const createHttp = (baseURL) =>
  axios.create({
    baseURL,
    timeout: 30000,
    validateStatus: () => true,
  });

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

const bootstrapOwnerUser = async ({ http, mobile }) => {
  const sendOtp = await timed('auth.send-otp', () => http.post('/auth/send-otp', { mobile }));
  assertStatus(sendOtp, 200, `Auth OTP send (${mobile})`);
  await forceOtp(mobile);

  const verifyOtp = await timed('auth.verify-otp', () => http.post('/auth/verify-otp', { mobile, otp: OTP }));
  assertStatus(verifyOtp, 200, `Auth OTP verify (${mobile})`);

  const setPin = await timed('auth.set-pin', () =>
    http.post('/auth/set-pin', {
      mobile,
      pin: PIN,
      otp_verified_token: verifyOtp.data?.otp_verified_token,
    })
  );
  assertStatus(setPin, 200, `Auth set PIN (${mobile})`);

  const loginPin = await timed('auth.login-pin', () => http.post('/auth/login', { mobile, pin: PIN }));
  assertStatus(loginPin, 200, `Auth PIN login (${mobile})`);

  return {
    mobile,
    user: loginPin.data?.user,
    token: loginPin.data?.token,
    refreshToken: loginPin.data?.refreshToken,
  };
};

const run = async () => {
  await pool.initializeDatabase();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const http = createHttp(`http://127.0.0.1:${port}`);

  try {
    const seed = Number(String(Date.now()).slice(-6));
    const ownerAMobile = createMobile('11', seed);
    const ownerBMobile = createMobile('12', seed);
    const caretakerMobile = createMobile('22', seed);
    const randomMobile = createMobile('33', seed);
    const nomineeMobile = createMobile('44', seed);

    const ownerA = await bootstrapOwnerUser({ http, mobile: ownerAMobile });
    const ownerB = await bootstrapOwnerUser({ http, mobile: ownerBMobile });
    const caretaker = await bootstrapOwnerUser({ http, mobile: caretakerMobile });
    const randomUser = await bootstrapOwnerUser({ http, mobile: randomMobile });

    const wrongOtp = await http.post('/auth/verify-otp', { mobile: ownerAMobile, otp: '000000' });
    assertStatus(wrongOtp, 401, 'Auth invalid OTP blocked');

    const wrongPin = await http.post('/auth/login', { mobile: ownerAMobile, pin: '9999' });
    assertStatus(wrongPin, 401, 'Auth wrong PIN blocked');

    const me = await timed('auth.me', () => http.get('/auth/me', { headers: authHeaders(ownerA.token) }));
    assertStatus(me, 200, 'Auth /me authorized');

    const ownerMedicine = await timed('owner.create-medicine', () =>
      http.post(
        '/api/medicines',
        {
          name: 'Paracetamol',
          dosage: '500mg',
          times_per_day: 2,
          time_slots: ['08:00', '20:00'],
        },
        { headers: authHeaders(ownerA.token) }
      )
    );
    assertStatus(ownerMedicine, 201, 'Owner can create medicine');

    const ownerScheduleCreate = await timed('owner.create-schedule', () =>
      http.post(
        '/api/schedules',
        {
          medicine_name: 'Paracetamol',
          dosage: '500mg',
          time: ['08:00', '14:00', '20:00'],
          repeat_type: 'daily',
        },
        { headers: authHeaders(ownerA.token) }
      )
    );
    assertStatus(ownerScheduleCreate, 201, 'Owner can create schedule');
    const ownerScheduleId = ownerScheduleCreate.data?.schedule?.id;
    const ownerScheduleReminderCount = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM medicine_reminders
        WHERE schedule_id = $1::uuid
      `,
      [ownerScheduleId]
    );
    recordCheck(
      'Schedule auto-creates reminders',
      ownerScheduleReminderCount.rows[0]?.count === 3,
      { reminder_count: ownerScheduleReminderCount.rows[0]?.count || 0 }
    );

    const ownerScheduleRead = await timed('owner.list-schedules', () =>
      http.get('/api/schedules', { headers: authHeaders(ownerA.token) })
    );
    assertStatus(ownerScheduleRead, 200, 'Owner can list schedules');
    const ownerScheduleSeen = (ownerScheduleRead.data?.schedules || []).some((item) => item.id === ownerScheduleId);
    recordCheck('Owner created schedule appears in list', ownerScheduleSeen);

    const ownerScheduleUpdate = await timed('owner.update-schedule', () =>
      http.put(
        `/api/schedules/${ownerScheduleId}`,
        {
          dosage: '650mg',
          time: ['09:00', '21:00'],
        },
        { headers: authHeaders(ownerA.token) }
      )
    );
    assertStatus(ownerScheduleUpdate, 200, 'Owner can update schedule');
    const ownerReminderDupCheck = await pool.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(DISTINCT reminder_time)::int AS distinct_times
        FROM medicine_reminders
        WHERE schedule_id = $1::uuid
      `,
      [ownerScheduleId]
    );
    recordCheck(
      'Schedule update avoids duplicate reminders',
      ownerReminderDupCheck.rows[0]?.total === 2 && ownerReminderDupCheck.rows[0]?.distinct_times === 2,
      ownerReminderDupCheck.rows[0]
    );

    const ownerReminderRead = await timed('owner.list-reminders', () =>
      http.get('/api/reminders', { headers: authHeaders(ownerA.token) })
    );
    assertStatus(ownerReminderRead, 200, 'Owner can list reminders');

    const ownerCreateReminder = await timed('owner.create-reminder', () =>
      http.post(
        '/api/reminders',
        {
          medicineName: 'Paracetamol',
          time: '10:30',
        },
        { headers: authHeaders(ownerA.token) }
      )
    );
    assertStatus(ownerCreateReminder, 201, 'Owner can create reminder');

    const ownerScheduleDelete = await timed('owner.delete-schedule', () =>
      http.delete(`/api/schedules/${ownerScheduleId}`, { headers: authHeaders(ownerA.token) })
    );
    assertStatus(ownerScheduleDelete, 200, 'Owner can delete schedule');
    const ownerRemindersAfterDelete = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM medicine_reminders
        WHERE schedule_id = $1::uuid
          AND status = 'pending'
      `,
      [ownerScheduleId]
    );
    recordCheck(
      'Deleting schedule removes pending reminders',
      ownerRemindersAfterDelete.rows[0]?.count === 0,
      { pending_count: ownerRemindersAfterDelete.rows[0]?.count || 0 }
    );

    const selfContextRead = await http.get('/api/schedules', { headers: authHeaders(ownerA.token) });
    assertStatus(selfContextRead, 200, 'Owner default patient_id self works');

    const addCaretaker = await timed('caretaker.add', () =>
      http.post(
        '/api/caretakers/add',
        { phone: caretakerMobile, relationship: 'brother' },
        { headers: authHeaders(ownerA.token) }
      )
    );
    assertStatus(addCaretaker, 201, 'Owner can add caretaker');
    const caretakerLinkId = addCaretaker.data?.caretaker?.id;

    await pool.query(
      `
        UPDATE caretakers
        SET otp_hash = $1::text,
            otp_expires_at = NOW() + INTERVAL '10 minutes',
            otp_attempts = 0
        WHERE id = $2::uuid
      `,
      [await bcrypt.hash(OTP, 10), caretakerLinkId]
    );

    const verifyCaretaker = await timed('caretaker.verify', () =>
      http.post(
        '/api/caretakers/verify',
        { caretaker_id: caretakerLinkId, otp: OTP },
        { headers: authHeaders(ownerA.token) }
      )
    );
    assertStatus(verifyCaretaker, 200, 'Caretaker verification succeeds');

    const caretakerApprovedRow = await pool.query(
      `SELECT status FROM caretakers WHERE id = $1::uuid LIMIT 1`,
      [caretakerLinkId]
    );
    recordCheck(
      'Caretaker DB status approved',
      caretakerApprovedRow.rows[0]?.status === 'approved',
      { status: caretakerApprovedRow.rows[0]?.status || null }
    );

    const caretakerRoles = await http.get('/api/user/roles', { headers: authHeaders(caretaker.token) });
    assertStatus(caretakerRoles, 200, 'Caretaker roles endpoint works');
    const caretakerOf = Array.isArray(caretakerRoles.data?.caretakerOf) ? caretakerRoles.data.caretakerOf : [];
    recordCheck('Caretaker roles include owner patient', caretakerOf.some((item) => item.patient_id === ownerA.user.id));

    const caretakerCreateMedicine = await timed('caretaker.create-medicine', () =>
      http.post(
        '/api/medicines',
        {
          patient_id: ownerA.user.id,
          name: 'Aspirin',
          dosage: '75mg',
          times_per_day: 1,
          time_slots: ['08:30'],
        },
        { headers: authHeaders(caretaker.token) }
      )
    );
    assertStatus(caretakerCreateMedicine, 201, 'Caretaker can create medicine for patient');

    const caretakerCreateSchedule = await timed('caretaker.create-schedule', () =>
      http.post(
        '/api/schedules',
        {
          patient_id: ownerA.user.id,
          medicine_name: 'Aspirin',
          dosage: '75mg',
          time: ['07:30', '19:30'],
          repeat_type: 'daily',
        },
        { headers: authHeaders(caretaker.token) }
      )
    );
    assertStatus(caretakerCreateSchedule, 201, 'Caretaker can create schedule for patient');
    const caretakerScheduleId = caretakerCreateSchedule.data?.schedule?.id;
    const caretakerCreatedByCheck = await pool.query(
      `
        SELECT created_by, patient_id
        FROM medicine_schedules
        WHERE id = $1::uuid
      `,
      [caretakerScheduleId]
    );
    recordCheck(
      'Caretaker-created schedule stores correct created_by and patient_id',
      caretakerCreatedByCheck.rows[0]?.created_by === caretaker.user.id
        && caretakerCreatedByCheck.rows[0]?.patient_id === ownerA.user.id,
      caretakerCreatedByCheck.rows[0] || {}
    );

    const caretakerUpdateSchedule = await http.put(
      `/api/schedules/${caretakerScheduleId}`,
      {
        patient_id: ownerA.user.id,
        time: ['07:45', '19:45'],
        repeat_type: 'weekly',
      },
      { headers: authHeaders(caretaker.token) }
    );
    assertStatus(caretakerUpdateSchedule, 200, 'Caretaker can update schedule for patient');

    const caretakerPatientDataRead = await http.get('/api/medicines', {
      headers: authHeaders(caretaker.token),
      params: { patient_id: ownerA.user.id },
    });
    assertStatus(caretakerPatientDataRead, 200, 'Caretaker can view patient medicines');

    const caretakerDeleteSchedule = await http.delete(`/api/schedules/${caretakerScheduleId}`, {
      headers: authHeaders(caretaker.token),
      params: { patient_id: ownerA.user.id },
    });
    assertStatus(caretakerDeleteSchedule, 200, 'Caretaker can delete schedule for patient');

    const randomUserDenied = await http.get('/api/schedules', {
      headers: authHeaders(randomUser.token),
      params: { patient_id: ownerA.user.id },
    });
    assertStatus(randomUserDenied, 403, 'Random user blocked from another patient');

    const addPendingCaretaker = await http.post(
      '/api/caretakers/add',
      { phone: randomMobile, relationship: 'neighbor' },
      { headers: authHeaders(ownerB.token) }
    );
    assertStatus(addPendingCaretaker, 201, 'Owner B can add caretaker (pending)');

    const pendingAccessDenied = await http.get('/api/schedules', {
      headers: authHeaders(randomUser.token),
      params: { patient_id: ownerB.user.id },
    });
    assertStatus(pendingAccessDenied, 403, 'Pending caretaker blocked');

    const fakePatientDenied = await http.get('/api/schedules', {
      headers: authHeaders(caretaker.token),
      params: { patient_id: 'not-a-uuid' },
    });
    assertStatus(fakePatientDenied, 400, 'Invalid patient_id blocked');

    const tamperedToken = `${ownerA.token}tamper`;
    const tamperedDenied = await http.get('/api/schedules', { headers: authHeaders(tamperedToken) });
    assertStatus(tamperedDenied, 401, 'Token tampering blocked');

    const decoded = jwt.decode(ownerA.token) || {};
    const expiredToken = jwt.sign(
      {
        sub: ownerA.user.id,
        userId: ownerA.user.id,
        mobile: ownerAMobile,
        role: 'user',
        sid: decoded.sid,
        type: 'access',
      },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    );
    const expiredDenied = await http.get('/api/schedules', { headers: authHeaders(expiredToken) });
    assertStatus(expiredDenied, 401, 'Expired token blocked');

    const catalog = await pool.query(
      `
        SELECT question_key
        FROM security_question_catalog
        WHERE is_active = TRUE
        ORDER BY display_order ASC, question_key ASC
        LIMIT 3
      `
    );
    const questionKeys = catalog.rows.map((item) => item.question_key);
    const answerMap = {
      [questionKeys[0]]: 'alpha',
      [questionKeys[1]]: 'bravo',
      [questionKeys[2]]: 'charlie',
    };

    const saveSecurityQuestions = await http.post(
      '/api/security-questions/save',
      {
        questions: questionKeys.map((key) => ({
          question_key: key,
          answer: answerMap[key],
        })),
      },
      { headers: authHeaders(ownerA.token) }
    );
    assertStatus(saveSecurityQuestions, 200, 'Owner saves security questions');

    const nomineeCreate = await http.post(
      '/api/nominees',
      { name: 'Nominee One', phone: nomineeMobile, relationship: 'sister' },
      { headers: authHeaders(ownerA.token) }
    );
    assertStatus(nomineeCreate, 201, 'Owner creates nominee');
    const nomineeId = nomineeCreate.data?.nominee?.id;

    const nomineeSendVerify = await http.post(
      '/api/nominees/send-verification',
      { nominee_id: nomineeId },
      { headers: authHeaders(ownerA.token) }
    );
    assertStatus(nomineeSendVerify, 200, 'Owner sends nominee verification OTP');

    await pool.query(
      `
        UPDATE nominee_verifications
        SET security_answers_json = COALESCE(security_answers_json, '{}'::jsonb) || jsonb_build_object(
              'otp_hash', $1::text,
              'otp_expires_at', to_char((NOW() + INTERVAL '10 minutes'), 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),
              'otp_attempts', 0
            ),
            updated_at = NOW()
        WHERE nominee_id = $2::uuid
      `,
      [await bcrypt.hash(OTP, 10), nomineeId]
    );

    const nomineeVerifyOtp = await http.post(
      '/api/nominees/verify',
      { nominee_id: nomineeId, otp: OTP },
      { headers: authHeaders(ownerA.token) }
    );
    assertStatus(nomineeVerifyOtp, 200, 'Nominee OTP verification for approval succeeds');

    const emergencyTrigger = await http.post('/api/emergency/trigger', {}, { headers: authHeaders(ownerA.token) });
    assertStatus(emergencyTrigger, 201, 'Emergency trigger succeeds');
    const emergencyGrant = await http.post('/api/emergency/grant-access', {}, { headers: authHeaders(ownerA.token) });
    assertStatus(emergencyGrant, 200, 'Emergency grant-access succeeds');

    const nomineeAccessSendOtp = await http.post('/api/nominee-access/send-otp', { phone: nomineeMobile });
    assertStatus(nomineeAccessSendOtp, 200, 'Nominee access OTP send succeeds');
    await forceOtp(nomineeMobile);

    const nomineeAccessVerifyOtp = await http.post('/api/nominee-access/verify-otp', { phone: nomineeMobile, otp: OTP });
    assertStatus(nomineeAccessVerifyOtp, 200, 'Nominee access OTP verify succeeds');
    const challengeToken = nomineeAccessVerifyOtp.data?.challenge_token;

    const nomineeChallenge = await http.post('/api/nominee-access/challenge', {
      challenge_token: challengeToken,
      nominee_id: nomineeId,
    });
    assertStatus(nomineeChallenge, 200, 'Nominee security challenge load succeeds');

    const challengeAnswers = (nomineeChallenge.data?.questions || []).map((question) => ({
      question_key: question.question_key,
      answer: answerMap[question.question_key] || 'alpha',
    }));

    const nomineeVerifySecurity = await http.post('/api/nominee-access/verify-security', {
      challenge_token: challengeToken,
      nominee_id: nomineeId,
      answers: challengeAnswers,
    });
    assertStatus(nomineeVerifySecurity, 200, 'Nominee security verification succeeds');
    const nomineeToken = nomineeVerifySecurity.data?.token;

    const nomineeFiles = await http.get('/api/nominee-access/files', { headers: authHeaders(nomineeToken) });
    assertStatus(nomineeFiles, 200, 'Nominee can read emergency files');

    const nomineeWriteDenied = await http.post(
      '/api/vault/create',
      {
        title: 'Blocked write',
        type: 'custom',
        fields: [{ label: 'test', value: 'value' }],
      },
      { headers: authHeaders(nomineeToken) }
    );
    assertStatus(nomineeWriteDenied, 403, 'Nominee write blocked (read-only)');

    const refreshOk = await timed('auth.refresh', () => http.post('/auth/refresh', { refreshToken: ownerA.refreshToken }));
    assertStatus(refreshOk, 200, 'Refresh token flow works');
    const refreshedToken = refreshOk.data?.token;

    const logoutOk = await http.post('/auth/logout', { refreshToken: ownerA.refreshToken });
    assertStatus(logoutOk, 200, 'Logout endpoint works');

    const logoutAll = await http.post('/auth/logout-all', {}, { headers: authHeaders(refreshedToken) });
    assertStatus(logoutAll, 200, 'Logout-all endpoint works');

    const afterLogoutDenied = await http.get('/auth/me', { headers: authHeaders(refreshedToken) });
    assertStatus(afterLogoutDenied, 401, 'Session revoked after logout-all');

    const scheduleRowCheck = await pool.query(
      `
        SELECT id, patient_id, created_by, schedule_times, repeat_type
        FROM medicine_schedules
        WHERE patient_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [ownerA.user.id]
    );
    recordCheck('Schedule rows store patient_id and created_by', Boolean(scheduleRowCheck.rows[0]), {
      row: scheduleRowCheck.rows[0] || null,
    });

    const orphanSchedules = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM medicine_schedules s
        LEFT JOIN users u1 ON u1.id = s.patient_id
        LEFT JOIN users u2 ON u2.id = s.created_by
        WHERE s.is_active = TRUE
          AND (u1.id IS NULL OR u2.id IS NULL)
      `
    );
    recordCheck('No orphan active schedules', orphanSchedules.rows[0]?.count === 0, {
      orphan_count: orphanSchedules.rows[0]?.count,
    });

    const duplicateCaretakerLinks = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM (
          SELECT user_id, caretaker_user_id
          FROM caretakers
          WHERE caretaker_user_id IS NOT NULL
          GROUP BY user_id, caretaker_user_id
          HAVING COUNT(*) > 1
        ) dup
      `
    );
    recordCheck('No duplicate caretaker links', duplicateCaretakerLinks.rows[0]?.count === 0, {
      duplicate_count: duplicateCaretakerLinks.rows[0]?.count,
    });

    const rolesNoAssignment = await http.get('/api/user/roles', { headers: authHeaders(randomUser.token) });
    assertStatus(rolesNoAssignment, 200, 'User roles endpoint works for non-caretaker');
    recordCheck(
      'No caretaker assigned returns empty list',
      Array.isArray(rolesNoAssignment.data?.caretakerOf) && rolesNoAssignment.data.caretakerOf.length === 0
    );

    const addCaretakerOwnerB = await http.post(
      '/api/caretakers/add',
      { phone: caretakerMobile, relationship: 'family' },
      { headers: authHeaders(ownerB.token) }
    );
    assertStatus(addCaretakerOwnerB, 201, 'Caretaker added for second owner');
    const link2 = addCaretakerOwnerB.data?.caretaker?.id;
    await pool.query(
      `
        UPDATE caretakers
        SET otp_hash = $1::text,
            otp_expires_at = NOW() + INTERVAL '10 minutes',
            otp_attempts = 0
        WHERE id = $2::uuid
      `,
      [await bcrypt.hash(OTP, 10), link2]
    );
    const verify2 = await http.post(
      '/api/caretakers/verify',
      { caretaker_id: link2, otp: OTP },
      { headers: authHeaders(ownerB.token) }
    );
    assertStatus(verify2, 200, 'Second caretaker approval succeeds');

    const caretakerRolesMulti = await http.get('/api/user/roles', { headers: authHeaders(caretaker.token) });
    assertStatus(caretakerRolesMulti, 200, 'Caretaker roles list works with multiple patients');
    recordCheck(
      'Caretaker with multiple patients receives >=2 assignments',
      Array.isArray(caretakerRolesMulti.data?.caretakerOf) && caretakerRolesMulti.data.caretakerOf.length >= 2,
      { count: caretakerRolesMulti.data?.caretakerOf?.length || 0 }
    );

    const metricSummary = state.metrics.reduce(
      (acc, item) => {
        acc.total += item.elapsedMs;
        acc.max = Math.max(acc.max, item.elapsedMs);
        return acc;
      },
      { total: 0, max: 0 }
    );
    const avg = state.metrics.length ? Number((metricSummary.total / state.metrics.length).toFixed(2)) : 0;
    recordCheck('Performance: average checked API response <= 700ms', avg <= 700, { average_ms: avg });
    recordCheck('Performance: max checked API response <= 2500ms', metricSummary.max <= 2500, {
      max_ms: metricSummary.max,
    });

    const result = {
      summary: {
        total_checks: state.checks.length,
        passed: state.checks.filter((check) => check.passed).length,
        failed: state.failures.length,
      },
      failures: state.failures,
      performance: {
        samples: state.metrics.length,
        average_ms: avg,
        max_ms: metricSummary.max,
      },
    };

    console.log(JSON.stringify(result, null, 2));
    if (state.failures.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        summary: { total_checks: state.checks.length, passed: state.checks.filter((c) => c.passed).length, failed: 1 },
        failures: [{ name: 'Fatal script error', passed: false, message: error.message }],
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
