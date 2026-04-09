const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const isExpoPushToken = (token) => /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(String(token || '').trim());

const sendExpoPushNotification = async ({ token, title, body, data }) => {
  const pushToken = String(token || '').trim();

  if (!pushToken) {
    return { success: false, error: 'Missing push token' };
  }

  const response = await axios.post(
    EXPO_PUSH_URL,
    {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: data || {},
      priority: 'high',
    },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  const ticket = response?.data?.data;

  if (!ticket) {
    return { success: false, error: 'Invalid push response' };
  }

  if (ticket.status === 'ok') {
    return {
      success: true,
      ticketId: ticket.id,
    };
  }

  return {
    success: false,
    error: ticket.message || ticket.details?.error || 'Push delivery failed',
  };
};

module.exports = {
  isExpoPushToken,
  sendExpoPushNotification,
};
