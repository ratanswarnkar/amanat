import { api } from './client';

export const getLifeStatus = async () => {
  const { data } = await api.get('/api/life/status');
  return data;
};

export const confirmLife = async (payload = {}) => {
  const { data } = await api.post('/api/life/confirm', payload);
  return data;
};

export const updateLifeSettings = async ({ confirmation_interval_days }) => {
  const { data } = await api.post('/api/life/settings', {
    confirmation_interval_days,
  });
  return data;
};

export const adminOverrideLifeStatus = async ({ target_user_id, action, reason, override_hours }) => {
  const { data } = await api.post('/api/life/admin-override', {
    target_user_id,
    action,
    reason,
    override_hours,
  });
  return data;
};
