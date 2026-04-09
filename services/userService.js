import { api } from '../src/api/client';

export const getUserRoles = async () => {
  const { data } = await api.get('/api/user/roles');
  const caretakerOf = Array.isArray(data?.caretakerOf) ? data.caretakerOf : [];

  return {
    isOwner: Boolean(data?.isOwner ?? true),
    caretakerOf: caretakerOf
      .filter((item) => String(item?.status || '').toLowerCase() === 'approved')
      .map((item) => ({
        patient_id: item.patient_id,
        patient_name: item.patient_name || 'Patient',
        status: item.status || 'approved',
      })),
  };
};
