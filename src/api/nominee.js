import { api } from './client';

export const getNominees = async () => {
  const { data } = await api.get('/api/nominees');
  return data?.nominees || [];
};

export const createNominee = async (payload) => {
  const { data } = await api.post('/api/nominees', payload);
  return data;
};

export const deleteNominee = async (id) => {
  const { data } = await api.delete(`/api/nominees/${id}`);
  return data;
};

export const sendVerification = async (nomineeId) => {
  const { data } = await api.post('/api/nominees/send-verification', {
    nominee_id: nomineeId,
  });
  return data;
};

export const verifyNominee = async ({ nominee_id, otp }) => {
  const { data } = await api.post('/api/nominees/verify', {
    nominee_id,
    otp,
  });
  return data;
};
