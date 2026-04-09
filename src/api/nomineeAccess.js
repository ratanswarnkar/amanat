import { api } from './client';

export const sendNomineeAccessOtp = async ({ phone }) => {
  const { data } = await api.post('/api/nominee-access/send-otp', { phone });
  return data;
};

export const verifyNomineeAccessOtp = async ({ phone, otp }) => {
  const { data } = await api.post('/api/nominee-access/verify-otp', {
    phone,
    otp,
  });
  return data;
};

export const loadNomineeAccessChallenge = async ({ challenge_token, nominee_id }) => {
  const { data } = await api.post('/api/nominee-access/challenge', {
    challenge_token,
    nominee_id,
  });
  return data;
};

export const verifyNomineeAccessSecurity = async ({ challenge_token, nominee_id, answers }) => {
  const { data } = await api.post('/api/nominee-access/verify-security', {
    challenge_token,
    nominee_id,
    answers,
  });
  return data;
};

export const getNomineeAccessStatus = async () => {
  const { data } = await api.get('/api/nominee-access/status');
  return data;
};

export const getNomineeAccessFiles = async () => {
  const { data } = await api.get('/api/nominee-access/files');
  return data?.data || [];
};
