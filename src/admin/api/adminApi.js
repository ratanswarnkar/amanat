import { API_URL } from '../../config/env';

const ADMIN_SESSION_KEY = 'AMANAT_ADMIN_SESSION';
const BASE_URL = API_URL;
const ADMIN_API_BASE_URL = `${BASE_URL}/api/admin`;

let authToken = '';
let authFailureHandler = null;

const getStoredSession = () => {
  if (typeof window === 'undefined') {
    return { token: '', admin: null };
  }

  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) {
      return { token: '', admin: null };
    }

    const parsed = JSON.parse(raw);
    return {
      token: String(parsed?.token || ''),
      admin: parsed?.admin || null,
    };
  } catch (_error) {
    return { token: '', admin: null };
  }
};

const persistSession = ({ token, admin }) => {
  authToken = String(token || '');

  if (typeof window === 'undefined') {
    return;
  }

  if (!authToken || !admin) {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    return;
  }

  window.localStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({
      token: authToken,
      admin,
    })
  );
};

const clearSession = () => {
  authToken = '';

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
  }
};

const setToken = (token) => {
  authToken = String(token || '');
};

const setAuthFailureHandler = (handler) => {
  authFailureHandler = typeof handler === 'function' ? handler : null;
};

const normalizeError = (error) => {
  console.error('[Admin API Error]', {
    response: error?.response?.data || null,
    message: error?.message || 'Unknown error',
    status: error?.response?.status || null,
  });

  const message =
    error?.response?.data?.message ||
    error?.message ||
    'Request failed.';

  const normalized = new Error(message);
  normalized.status = error?.response?.status || 500;
  normalized.response = error?.response || null;
  return normalized;
};

const request = async (path, options = {}) => {
  if (!authToken) {
    const stored = getStoredSession();
    authToken = String(stored?.token || '');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(`${ADMIN_API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.message || `Request failed with status ${response.status}`);
      error.response = {
        status: response.status,
        data,
      };

      throw error;
    }

    return data;
  } catch (error) {
    const normalized = normalizeError(error);

    if ((normalized.status === 401 || normalized.status === 403) && authFailureHandler) {
      authFailureHandler(normalized);
    }

    throw normalized;
  }
};

const getDisplayName = (user) => {
  const candidates = [
    user?.name,
    user?.full_name,
    user?.fullName,
    [user?.first_name, user?.last_name].filter(Boolean).join(' '),
  ];

  const resolved = candidates.find((value) => String(value || '').trim());
  return String(resolved || 'Unnamed User').trim();
};

const toUserSummary = (user) => ({
  id: user.id,
  name: getDisplayName(user),
  fullName: getDisplayName(user),
  phone: user.mobile || user.phone || '--',
  email: user.email || '--',
  role: user.role || 'user',
  status: user.is_blocked ? 'blocked' : 'active',
  createdAt: user.created_at || user.createdAt || null,
  isBlocked: Boolean(user.is_blocked),
  isActive: user.is_active,
  isMobileVerified: Boolean(user.is_mobile_verified),
  lastLoginAt: user.last_login_at || user.lastLoginAt || null,
  emergencyStatus: user.emergency_status || user.emergencyStatus || null,
});

const computeStats = (users) => {
  const totalUsers = users.length;
  const blockedUsers = users.filter((user) => user.status === 'blocked').length;
  const activeUsers = totalUsers - blockedUsers;

  return {
    totalUsers,
    activeUsers,
    blockedUsers,
  };
};

const login = async ({ email, password }) => {
  const data = await request('/login', {
    method: 'POST',
    body: {
      email,
      password,
    },
  });

  const session = {
    token: data?.token || '',
    admin: {
      id: data?.user?.id || '',
      name: data?.user?.full_name || data?.user?.name || 'Admin',
      email: data?.user?.email || email,
      role: data?.user?.role || 'admin',
    },
  };

  if (!session.token) {
    throw new Error('Admin token was not returned by the server.');
  }

  if (String(session.admin?.role || '').toLowerCase() !== 'admin') {
    clearSession();
    throw new Error('This account does not have admin access.');
  }

  persistSession(session);
  return session;
};

const getUsers = async ({ page = 1, limit = 20 } = {}) => {
  const data = await request(`/users?page=${page}&limit=${limit}`);

  const users = Array.isArray(data?.users) ? data.users.map(toUserSummary) : [];
  const pagination = data?.pagination || {
    page,
    limit,
    total: users.length,
  };

  return {
    users,
    pagination,
    stats: computeStats(users),
  };
};

const getUserById = async (userId) => {
  const data = await request(`/users/${userId}`);
  return toUserSummary(data?.user || {});
};

const updateUserStatus = async (userId, action) => {
  let data;

  try {
    data = await request(`/users/${userId}/${action}`, {
      method: 'PATCH',
    });
  } catch (primaryError) {
    const shouldFallback = primaryError?.status === 404 || primaryError?.status === 405;
    if (!shouldFallback) {
      throw primaryError;
    }

    data = await request(`/${action}/${userId}`, {
      method: 'POST',
    });
  }

  return toUserSummary(data?.user || {});
};

const bootstrapSession = () => {
  const stored = getStoredSession();
  if (!stored.token || !stored.admin) {
    clearSession();
    return { token: '', admin: null };
  }

  if (String(stored.admin?.role || '').toLowerCase() !== 'admin') {
    clearSession();
    return { token: '', admin: null };
  }

  setToken(stored.token);
  return stored;
};

export const adminApi = {
  login,
  getUsers,
  getUserById,
  blockUser: (userId) => updateUserStatus(userId, 'block'),
  unblockUser: (userId) => updateUserStatus(userId, 'unblock'),
  computeStats,
  bootstrapSession,
  getStoredSession,
  setToken,
  clearSession,
  setAuthFailureHandler,
  BASE_URL,
};
