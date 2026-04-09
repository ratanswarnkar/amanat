import { api } from './client';
import { API_URL } from '../config/env';
import { getToken } from '../utils/secureStore';
import { getActivePatientId } from '../utils/caretakerModeStore';

const ALLOWED_UPLOAD_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

const normalizeMimeType = (rawType = '', rawName = '') => {
  const type = String(rawType || '').toLowerCase().trim();
  if (type === 'image/jpg') {
    return 'image/jpeg';
  }
  if (type) {
    return type;
  }

  const fileName = String(rawName || '').toLowerCase();
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.pdf')) return 'application/pdf';
  return '';
};

const normalizeUploadFile = (file) => {
  if (!file || typeof file !== 'object') {
    return null;
  }

  const uri = String(file.uri || '');
  if (!uri) {
    return null;
  }

  const fallbackName = uri.split('/').pop() || `upload-${Date.now()}`;
  const name = String(file.name || fallbackName);
  const type = normalizeMimeType(file.type, name);

  if (!ALLOWED_UPLOAD_MIME_TYPES.has(type)) {
    throw new Error('Only JPEG, PNG, and PDF files are allowed');
  }

  return { uri, name, type };
};

export const getMedicines = async () => {
  const { data } = await api.get('/api/medicines');
  return data.medicines || [];
};

export const createMedicine = async (payload) => {
  const { data } = await api.post('/api/medicines', payload);
  return data;
};

export const getTodayMedicines = async () => {
  const { data } = await api.get('/api/medicines/today');
  return data || [];
};

export const markMedicineTaken = async (payload) => {
  const { data } = await api.post('/api/medicines/mark-taken', payload);
  return data;
};

export const markMedicineMissed = async (payload) => {
  const { data } = await api.post('/api/medicines/mark-missed', payload);
  return data;
};

export const getAdherenceSummary = async () => {
  const { data } = await api.get('/api/medicines/adherence-summary');
  return data;
};

export const getReminders = async () => {
  const { data } = await api.get('/api/reminders');
  return Array.isArray(data) ? data : data?.reminders || [];
};

export const getSchedules = async () => {
  const { data } = await api.get('/api/schedules');
  return Array.isArray(data?.schedules) ? data.schedules : [];
};

export const createSchedule = async (payload) => {
  const { data } = await api.post('/api/schedules', payload);
  return data?.schedule || data;
};

export const updateSchedule = async (scheduleId, payload) => {
  const { data } = await api.put(`/api/schedules/${scheduleId}`, payload);
  return data?.schedule || data;
};

export const deleteSchedule = async (scheduleId) => {
  const { data } = await api.delete(`/api/schedules/${scheduleId}`);
  return data;
};

export const createReminder = async (payload) => {
  const body = {
    medicineName: payload?.medicineName,
    time: payload?.time,
    medicine_id: payload?.medicine_id,
    reminder_time: payload?.reminder_time,
  };
  const { data } = await api.post('/api/reminders', body);
  return data;
};

export const completeReminder = async (reminderId) => {
  const { data } = await api.post(`/api/reminders/${reminderId}/complete`, {});
  return data;
};

export const registerNotificationDevice = async (payload) => {
  const { data } = await api.post('/api/notifications/device-token', payload);
  return data;
};

export const getNotificationHistory = async () => {
  const { data } = await api.get('/api/notifications/history');
  return data?.history || [];
};

export const getInventory = async () => {
  const { data } = await api.get('/api/inventory');
  return data.inventory || [];
};

export const getHealthRecords = async () => {
  const { data } = await api.get('/api/health-records');
  return data.records || [];
};

export const uploadHealthRecord = async (payload) => {
  const normalizedFile = normalizeUploadFile(payload?.file);

  if (!normalizedFile) {
    throw new Error('File is required');
  }

  const uploadFormData = new FormData();
  uploadFormData.append('title', String(payload?.title || '').trim());
  uploadFormData.append('record_type', String(payload?.record_type || '').trim());
  uploadFormData.append('record_date', String(payload?.record_date || '').trim());
  uploadFormData.append('notes', String(payload?.notes || '').trim());
  const patientId = await getActivePatientId();
  if (patientId) {
    uploadFormData.append('patient_id', patientId);
  }
  uploadFormData.append('file', {
    uri: normalizedFile.uri,
    name: normalizedFile.name || 'upload.jpg',
    type: normalizedFile.type || 'image/jpeg',
  });

  console.log('[HealthRecord Upload] payload', {
    title: payload?.title,
    record_type: payload?.record_type,
    record_date: payload?.record_date,
    notesPresent: Boolean(payload?.notes),
    file: payload?.file
      ? {
        uri: payload.file.uri,
        name: payload.file.name,
        type: payload.file.type,
      }
      : null,
  });
  console.log('Uploading file:', normalizedFile);
  console.log('Uploading with FormData...');
  console.log('FormData:', uploadFormData);
  const token = await getToken();
  const endpoint = `${String(API_URL || '').replace(/\/+$/, '')}/api/health-records`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: uploadFormData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `Upload failed (${response.status})`);
    error.response = {
      status: response.status,
      data,
    };
    throw error;
  }

  console.log('[HealthRecord Upload] response', data);
  return data;
};

export const createVoiceMedicine = async (voiceText) => {
  const { data } = await api.post('/api/voice/medicine', { voice_text: voiceText });
  return data;
};
