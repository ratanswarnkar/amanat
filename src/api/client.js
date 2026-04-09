import axios from 'axios';

import { API_URL } from '../config/env';
import { getActivePatientId } from '../utils/caretakerModeStore';
import {
  clearAuthSecrets,
  getRefreshToken,
  getToken,
  saveRefreshToken,
  saveToken,
} from '../utils/secureStore';

const API_BASE_URL = API_URL;

console.log('[API] baseURL =', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

let isRefreshing = false;
let refreshQueue = [];
let onAuthFailure = null;

const CARETAKER_SCOPED_PREFIXES = [
  '/api/medicines',
  '/api/health-records',
  '/api/inventory',
  '/api/prescriptions',
  '/api/vitals',
  '/api/reminders',
  '/api/schedules',
  '/api/notifications',
  '/api/voice/medicine',
];

const shouldAttachPatientId = (url = '') => {
  const normalizedUrl = String(url || '');
  return CARETAKER_SCOPED_PREFIXES.some((prefix) => normalizedUrl.startsWith(prefix));
};

const attachPatientIdToRequest = (config, patientId) => {
  if (!patientId) {
    return;
  }

  const method = String(config.method || 'get').toLowerCase();
  const isRead = method === 'get' || method === 'delete' || method === 'head';

  if (isRead) {
    config.params = config.params || {};
    if (!config.params.patient_id) {
      config.params.patient_id = patientId;
    }
    return;
  }

  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (!config.data.get?.('patient_id')) {
      config.data.append('patient_id', patientId);
    }
    return;
  }

  if (!config.data || typeof config.data !== 'object') {
    config.data = {};
  }

  if (!Object.prototype.hasOwnProperty.call(config.data, 'patient_id')) {
    config.data.patient_id = patientId;
  }
};

export const setAuthFailureHandler = (handler) => {
  onAuthFailure = typeof handler === 'function' ? handler : null;
};

const flushQueue = (error, token = null) => {
  refreshQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  refreshQueue = [];
};

const requestTokenRefresh = async () => {
  const storedRefreshToken = await getRefreshToken();

  if (!storedRefreshToken) {
    console.warn('[AUTH] Refresh blocked: missing refresh token');
    throw new Error('No refresh token available');
  }

  console.info('[AUTH] Refreshing access token');
  const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
    refreshToken: storedRefreshToken,
  });

  const nextToken = data?.token;
  const nextRefreshToken = data?.refreshToken;

  if (!nextToken || !nextRefreshToken) {
    console.warn('[AUTH] Refresh failed: invalid response payload');
    throw new Error('Invalid refresh response');
  }

  await saveToken(nextToken);
  await saveRefreshToken(nextRefreshToken);
  console.info('[AUTH] Refresh successful');

  return nextToken;
};

api.interceptors.request.use(async (config) => {
  console.log('[API] ->', (config.method || 'GET').toUpperCase(), `${config.baseURL || ''}${config.url || ''}`);

  config.headers = config.headers || {};
  try {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (shouldAttachPatientId(config.url)) {
      const activePatientId = await getActivePatientId();
      attachPatientIdToRequest(config, activePatientId);
    }
  } catch (error) {
    console.warn('[AUTH] Failed to load secure access token', { message: error?.message });
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log('[API] <-', response.status, response.config?.url);
    return response;
  },
  async (error) => {
    const originalRequest = error?.config || {};
    const status = error?.response?.status;

    if (status === 401 && !originalRequest._retry && !String(originalRequest.url || '').includes('/auth/refresh')) {
      if (isRefreshing) {
        const token = await new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        });

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const nextToken = await requestTokenRefresh();
        flushQueue(null, nextToken);

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        console.warn('[AUTH] Refresh failed, clearing secure session', {
          message: refreshError?.message,
          status: refreshError?.response?.status,
        });
        await clearAuthSecrets();
        if (onAuthFailure) {
          await Promise.resolve(onAuthFailure(refreshError)).catch(() => null);
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    console.log('[API] x', {
      message: error?.message,
      url: error?.config?.url,
      baseURL: error?.config?.baseURL,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    return Promise.reject(error);
  }
);

export { API_BASE_URL, api };
