import { api } from './client';

export const triggerEmergency = async (payload = {}) => {
  const { data } = await api.post('/api/emergency/trigger', payload);
  return data;
};

export const getEmergencyStatus = async () => {
  const { data } = await api.get('/api/emergency/status');
  return data;
};

export const grantEmergencyAccess = async (payload = {}) => {
  const { data } = await api.post('/api/emergency/grant-access', payload);
  return data;
};
