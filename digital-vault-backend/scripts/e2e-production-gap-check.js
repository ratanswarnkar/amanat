/* global __dirname */
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
process.env.DISABLE_BACKGROUND_JOBS = 'true';

const app = require('../src/app');
const pool = require('../src/config/db');

const asMobile = (suffix) => `93${String(suffix).padStart(8, '0')}`;

const expectStatus = (status, expected, label) => {
  if (status !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${status}`);
  }
};

const forceOtpForMobile = async ({ mobile, otp }) => {
  const hash = await bcrypt.hash(otp, 10);
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

const run = async () => {
  await pool.initializeDatabase();

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const baseURL = `http://127.0.0.1:${address.port}`;

  const http = axios.create({
    baseURL,
    timeout: 30000,
    validateStatus: () => true,
  });

  const cleanup = async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  };

  try {
    const nowTag = String(Date.now()).slice(-6);
    const ownerMobile = asMobile(Number(`11${nowTag.slice(-4)}`));
    const caretakerMobile = asMobile(Number(`22${nowTag.slice(-4)}`));
    const intruderMobile = asMobile(Number(`33${nowTag.slice(-4)}`));
    const otp = '123456';
    const pin = '1234';

    const bootstrapUser = async ({ mobile }) => {
      expectStatus((await http.post('/auth/send-otp', { mobile })).status, 200, `send otp ${mobile}`);
      await forceOtpForMobile({ mobile, otp });
      const verify = await http.post('/auth/verify-otp', { mobile, otp });
      expectStatus(verify.status, 200, `verify otp ${mobile}`);
      expectStatus(
        (await http.post('/auth/set-pin', {
          mobile,
          pin,
          otp_verified_token: verify.data?.otp_verified_token,
        })).status,
        200,
        `set pin ${mobile}`
      );
      const login = await http.post('/auth/login', { mobile, pin });
      expectStatus(login.status, 200, `login ${mobile}`);
      return {
        user: login.data?.user,
        token: login.data?.token,
        refreshToken: login.data?.refreshToken,
      };
    };

    const owner = await bootstrapUser({ mobile: ownerMobile });
    const caretaker = await bootstrapUser({ mobile: caretakerMobile });
    const intruder = await bootstrapUser({ mobile: intruderMobile });

    const addCaretaker = await http.post(
      '/api/caretakers/add',
      {
        name: 'Caretaker User',
        phone: caretakerMobile,
        relationship: 'friend',
      },
      { headers: { Authorization: `Bearer ${owner.token}` } }
    );
    expectStatus(addCaretaker.status, 201, 'add caretaker');

    const caretakerId = addCaretaker.data?.caretaker?.id;
    await pool.query(
      `
        UPDATE caretakers
        SET otp_hash = $1::text,
            otp_expires_at = NOW() + INTERVAL '10 minutes',
            otp_attempts = 0
        WHERE id = $2::uuid
      `,
      [await bcrypt.hash(otp, 10), caretakerId]
    );

    const verifyCaretaker = await http.post(
      '/api/caretakers/verify',
      { caretaker_id: caretakerId, otp },
      { headers: { Authorization: `Bearer ${owner.token}` } }
    );
    expectStatus(verifyCaretaker.status, 200, 'verify caretaker');

    const roles = await http.get('/api/user/roles', {
      headers: { Authorization: `Bearer ${caretaker.token}` },
    });
    expectStatus(roles.status, 200, 'get roles');
    if (!Array.isArray(roles.data?.caretakerOf) || roles.data.caretakerOf.length === 0) {
      throw new Error('roles response does not include caretaker assignment');
    }

    const createScheduleResp = await http.post(
      '/api/schedules',
      {
        patient_id: owner.user.id,
        medicine_name: 'Metformin',
        dosage: '500mg',
        time: ['08:00', '20:00'],
        repeat_type: 'daily',
      },
      { headers: { Authorization: `Bearer ${caretaker.token}` } }
    );
    expectStatus(createScheduleResp.status, 201, 'caretaker create schedule');
    const scheduleId = createScheduleResp.data?.schedule?.id;

    const listScheduleResp = await http.get('/api/schedules', {
      params: { patient_id: owner.user.id },
      headers: { Authorization: `Bearer ${caretaker.token}` },
    });
    expectStatus(listScheduleResp.status, 200, 'caretaker list schedules');
    const hasCreatedSchedule = (listScheduleResp.data?.schedules || []).some((item) => item.id === scheduleId);
    if (!hasCreatedSchedule) {
      throw new Error('created schedule was not returned in list endpoint');
    }

    const intruderDenied = await http.post(
      '/api/schedules',
      {
        patient_id: owner.user.id,
        medicine_name: 'Unauthorized',
        dosage: '1',
        time: ['09:00'],
        repeat_type: 'daily',
      },
      { headers: { Authorization: `Bearer ${intruder.token}` } }
    );
    expectStatus(intruderDenied.status, 403, 'intruder schedule create blocked');

    const decodedAccess = jwt.decode(owner.token) || {};
    const expiredToken = jwt.sign(
      {
        sub: owner.user.id,
        userId: owner.user.id,
        mobile: ownerMobile,
        role: 'user',
        sid: decodedAccess.sid,
        type: 'access',
      },
      process.env.JWT_SECRET,
      { expiresIn: -60 }
    );

    const expiredCall = await http.get('/api/schedules', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expectStatus(expiredCall.status, 401, 'expired jwt rejected');

    const refreshOk = await http.post('/auth/refresh', { refreshToken: owner.refreshToken });
    expectStatus(refreshOk.status, 200, 'refresh with valid token');

    const refreshFail = await http.post('/auth/refresh', { refreshToken: 'invalid-refresh-token' });
    expectStatus(refreshFail.status, 401, 'refresh with invalid token rejected');

    const deleteScheduleResp = await http.delete(`/api/schedules/${scheduleId}`, {
      params: { patient_id: owner.user.id },
      headers: { Authorization: `Bearer ${caretaker.token}` },
    });
    expectStatus(deleteScheduleResp.status, 200, 'caretaker delete schedule');

    console.log(
      JSON.stringify(
        {
          success: true,
          checks: [
            'caretaker creates schedule for assigned patient',
            'unassigned user blocked (403)',
            'expired JWT blocked (401)',
            'refresh succeeds with valid refresh token',
            'refresh fails with invalid refresh token',
            'schedule CRUD responds with expected statuses',
          ],
        },
        null,
        2
      )
    );
  } finally {
    await cleanup();
  }
};

run().catch((error) => {
  console.error(JSON.stringify({ success: false, message: error.message }, null, 2));
  process.exitCode = 1;
});
