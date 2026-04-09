import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import LoginForm from './components/LoginForm';
import { adminApi } from './api/adminApi';
import './admin.css';

const LOGIN_PATH = '/login';
const DASHBOARD_PATH = '/dashboard';
const USERS_PATH = '/users';

const initialSession = {
  token: '',
  admin: null,
};

const initialToast = {
  type: '',
  message: '',
};

export default function AdminApp() {
  const [session, setSession] = useState(() => adminApi.bootstrapSession());
  const [pathname, setPathname] = useState(() => {
    if (typeof window === 'undefined') {
      return LOGIN_PATH;
    }

    return window.location.pathname || '/';
  });
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState(initialToast);

  const isAuthenticated = Boolean(session.token && session.admin);
  const currentSection = useMemo(() => {
    if (pathname === USERS_PATH) {
      return 'users';
    }

    return 'dashboard';
  }, [pathname]);

  const navigate = useCallback((nextPath, options = {}) => {
    if (typeof window === 'undefined') {
      setPathname(nextPath);
      return;
    }

    const normalizedPath = nextPath === USERS_PATH
      ? USERS_PATH
      : nextPath === DASHBOARD_PATH
        ? DASHBOARD_PATH
        : LOGIN_PATH;
    const shouldReplace = Boolean(options.replace);
    const historyMethod = shouldReplace ? 'replaceState' : 'pushState';

    if (window.location.pathname !== normalizedPath) {
      window.history[historyMethod](window.history.state, '', normalizedPath);
    }

    setPathname(normalizedPath);
  }, []);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast.message) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setToast(initialToast);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleLogout = useCallback(() => {
    adminApi.clearSession();
    setSession(initialSession);
    navigate(LOGIN_PATH, { replace: true });
    setUsers([]);
    setStats(null);
    setPagination({
      page: 1,
      limit: 10,
      total: 0,
    });
    setBusyUserId('');
    setError('');
  }, [navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handlePopState = () => {
      setPathname(window.location.pathname || '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      if (pathname !== LOGIN_PATH) {
        navigate(LOGIN_PATH, { replace: true });
      }
      return;
    }

    if (pathname !== DASHBOARD_PATH && pathname !== USERS_PATH) {
      navigate(DASHBOARD_PATH, { replace: true });
    }
  }, [isAuthenticated, navigate, pathname]);

  useEffect(() => {
    adminApi.setAuthFailureHandler((failureError) => {
      handleLogout();
      showToast('error', failureError?.message || 'Your admin session has expired.');
    });

    return () => {
      adminApi.setAuthFailureHandler(null);
    };
  }, [handleLogout, showToast]);

  const loadUsers = useCallback(async (page = pagination.page) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await adminApi.getUsers({
        page,
        limit: pagination.limit,
      });

      setUsers(response.users);
      setStats(response.stats);
      setPagination(response.pagination);
    } catch (loadError) {
      setUsers([]);
      setStats(null);
      setError(loadError?.message || 'Unable to load users.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit, pagination.page]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadUsers(1);
  }, [isAuthenticated, loadUsers]);

  const handleLogin = async (credentials) => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await adminApi.login(credentials);
      setSession(response);
      navigate(DASHBOARD_PATH, { replace: true });
      showToast('success', 'Admin login successful.');
    } catch (loginError) {
      setError(loginError?.message || 'Admin login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePageChange = async (nextPage) => {
    if (nextPage < 1 || nextPage === pagination.page || isLoading) {
      return;
    }

    await loadUsers(nextPage);
  };

  const handleToggleBlock = useCallback(async (user) => {
    setError('');
    setBusyUserId(user.id);

    try {
      const updatedUser = user.isBlocked
        ? await adminApi.unblockUser(user.id)
        : await adminApi.blockUser(user.id);

      await loadUsers(pagination.page);

      showToast(
        'success',
        updatedUser.status === 'blocked'
          ? 'User blocked successfully.'
          : 'User unblocked successfully.'
      );
    } catch (actionError) {
      setError(actionError?.message || 'User action failed.');
      showToast('error', actionError?.message || 'User action failed.');
    } finally {
      setBusyUserId('');
    }
  }, [loadUsers, pagination.page, showToast]);

  useEffect(() => {
    setStats(adminApi.computeStats(users));
  }, [users]);

  if (!isAuthenticated) {
    return (
      <div className="admin-shell admin-auth-shell">
        {toast.message ? <div className={`admin-toast admin-toast-${toast.type}`}>{toast.message}</div> : null}
        <LoginForm onSubmit={handleLogin} isSubmitting={isSubmitting} error={error} />
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {toast.message ? <div className={`admin-toast admin-toast-${toast.type}`}>{toast.message}</div> : null}
      {currentSection === 'users' ? (
        <UsersPage
          admin={session.admin}
          users={users}
          pagination={pagination}
          onLogout={handleLogout}
          onToggleBlock={handleToggleBlock}
          onPageChange={handlePageChange}
          onNavigate={(section) => navigate(section === 'users' ? USERS_PATH : DASHBOARD_PATH)}
          error={error}
          isLoading={isLoading}
          busyUserId={busyUserId}
        />
      ) : (
        <DashboardPage
          admin={session.admin}
          stats={stats}
          onLogout={handleLogout}
          onNavigate={(section) => navigate(section === 'users' ? USERS_PATH : DASHBOARD_PATH)}
          error={error}
        />
      )}
    </div>
  );
}
