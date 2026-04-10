import { api } from './client';

export const sendOtp = async (mobile) => {
  const payload = { mobile };
  console.log('LOGIN API:', '/auth/send-otp');
  const { data } = await api.post('/auth/send-otp', payload);
  return data;
};

export const verifyOtp = async ({ mobile, otp }) => {
  console.log('LOGIN API:', '/auth/verify-otp');
  const { data } = await api.post('/auth/verify-otp', { mobile, otp });
  return data;
};

export const resendOtp = async (mobile) => {
  const { data } = await api.post('/auth/resend-otp', { mobile });
  return data;
};

export const loginWithPassword = async ({ phone, password }) => {
  const { data } = await api.post('/auth/login', { phone, password });
  return data;
};

export const setPin = async ({ mobile, pin, otp_verified_token }) => {
  const { data } = await api.post('/auth/set-pin', { mobile, pin, otp_verified_token });
  return data;
};

export const loginWithPin = async ({ mobile, pin }) => {
  console.log('LOGIN API:', '/auth/login');
  const { data } = await api.post('/auth/login', { mobile, pin });
  return data;
};

export const verifyPin = async ({ pin }) => {
  const { data } = await api.post('/auth/verify-pin', { pin });
  return data;
};

export const getCurrentUser = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

export const refreshSession = async (refreshToken) => {
  const { data } = await api.post('/auth/refresh', { refreshToken });
  return data;
};

export const logoutSession = async (refreshToken) => {
  const { data } = await api.post('/auth/logout', { refreshToken });
  return data;
};
