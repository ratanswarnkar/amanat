import { api } from './client';
import { API_URL } from '../config/env';
import { getToken } from '../utils/secureStore';

const normalizeUploadFile = (file) => {
  if (!file || typeof file !== 'object') {
    return null;
  }

  const uri = String(file.uri || '');
  if (!uri) {
    return null;
  }

  const name = String(file.name || 'upload.jpg');
  const type = String(file.mimeType || file.type || 'application/octet-stream');

  return { uri, name, type };
};

export const getVaultFiles = async () => {
  const { data } = await api.get('/api/vault/files');
  return data?.data || [];
};

export const getVaultEntries = async ({ type = 'all', sort = 'latest' } = {}) => {
  const { data } = await api.get('/api/vault', {
    params: { type, sort },
  });
  return data?.data || [];
};

export const searchVaultEntries = async ({ query, type = 'all', sort = 'latest' }) => {
  const { data } = await api.get('/api/vault/search', {
    params: { q: query, type, sort },
  });
  return data?.data || [];
};

export const createVaultEntry = async (payload) => {
  const { data } = await api.post('/api/vault/create', payload);
  return data?.data;
};

export const updateVaultEntry = async (id, payload) => {
  const { data } = await api.put(`/api/vault/${id}`, payload);
  return data?.data;
};

export const deleteVaultEntry = async (id) => {
  const { data } = await api.delete(`/api/vault/${id}`);
  return data?.data;
};

export const uploadVaultFile = async (file) => {
  const normalized = normalizeUploadFile(file);

  if (!normalized) {
    throw new Error('Invalid file selected for upload');
  }

  const formData = new FormData();
  formData.append('file', {
    uri: normalized.uri,
    name: normalized.name,
    type: normalized.type,
  });

  console.log('Uploading file:', normalized);
  console.log('FormData:', formData);
  const token = await getToken();
  const response = await fetch(`${API_URL}/api/vault/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(json?.message || `Upload failed (${response.status})`);
    error.response = {
      status: response.status,
      data: json,
    };
    throw error;
  }

  return json?.data;
};

export const deleteVaultFile = async (id) => {
  const { data } = await api.delete(`/api/vault/files/${id}`);
  return data?.data;
};
