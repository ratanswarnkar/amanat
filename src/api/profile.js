import { api } from './client';

export const fetchProfile = async () => {
  const { data } = await api.get('/api/profile');
  return data?.profile || null;
};

export const updateProfile = async (payload) => {
  const { data } = await api.put('/api/profile', payload);
  return data?.profile || null;
};

export const fetchUserRoles = async () => {
  const { data } = await api.get('/api/user/roles');
  return {
    isOwner: Boolean(data?.isOwner),
    caretakerOf: Array.isArray(data?.caretakerOf) ? data.caretakerOf : [],
  };
};
