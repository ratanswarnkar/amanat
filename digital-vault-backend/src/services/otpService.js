const axios = require('axios');
const logger = require('../utils/logger');

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const sendOtpSms = async ({ mobile, otp }) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔐 DEV OTP:', otp);
    console.log({
      mobile,
      otp,
      message: 'DEV MODE OTP',
    });

    logger.info('OTP SMS skipped in non-production; OTP logged to console', {
      mobileSuffix: String(mobile || '').slice(-4),
    });

    return { provider: 'dev-log', success: true };
  }

  const apiKey = process.env.FAST2SMS_API_KEY;
  const templateId = process.env.FAST2SMS_TEMPLATE_ID;

  if (!apiKey) {
    throw new Error('FAST2SMS_API_KEY is missing in production');
  }

  const payload = {
    route: 'otp',
    variables_values: otp,
    numbers: mobile,
  };

  if (templateId) {
    payload.flash = 0;
  }

  const response = await axios.post(
    'https://www.fast2sms.com/dev/bulkV2',
    payload,
    {
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  if (!response?.data || response.data.return !== true) {
    throw new Error(response?.data?.message?.[0] || 'OTP provider request failed');
  }

  return { provider: 'fast2sms', success: true };
};

module.exports = {
  generateOtp,
  sendOtpSms,
};
