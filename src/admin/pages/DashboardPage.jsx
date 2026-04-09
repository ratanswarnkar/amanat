import AdminButton from '../components/AdminButton';
import AdminCard from '../components/AdminCard';
import AdminLayout from '../components/AdminLayout';
import StatCard from '../components/StatCard';

export default function DashboardPage({
  admin,
  stats,
  onLogout,
  onNavigate,
  error,
}) {
  return (
    <AdminLayout
      title="Admin Dashboard"
      subtitle={`Welcome back, ${admin?.name || 'Admin'}. This workspace is focused only on user management.`}
      admin={admin}
      onLogout={onLogout}
      activeItem="dashboard"
      onNavigate={onNavigate}
    >
      {error ? <p className="admin-error">{error}</p> : null}

      <section className="stats-grid">
        <StatCard
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          subtitle="All accounts inside the Amanat ecosystem"
          tone="primary"
        />
        <StatCard
          label="Active Users"
          value={stats?.activeUsers ?? 0}
          subtitle="Accounts currently available for normal access"
          tone="success"
        />
        <StatCard
          label="Blocked Users"
          value={stats?.blockedUsers ?? 0}
          subtitle="Profiles temporarily restricted by admin action"
          tone="danger"
        />
      </section>

      <section className="dashboard-grid">
        <AdminCard
          className="hero-card"
          title="Users overview"
          subtitle="Jump straight into the user directory to search accounts, review status, and block or unblock users."
          actions={(
            <AdminButton variant="ghost" onClick={() => onNavigate?.('users')}>
              Open Users
            </AdminButton>
          )}
        >
          <div className="hero-metrics">
            <div>
              <strong>{stats?.totalUsers ?? 0}</strong>
              <span>Total managed accounts</span>
            </div>
            <div>
              <strong>{stats?.activeUsers ?? 0}</strong>
              <span>Currently active users</span>
            </div>
            <div>
              <strong>{stats?.blockedUsers ?? 0}</strong>
              <span>Users currently blocked</span>
            </div>
          </div>
        </AdminCard>
      </section>
    </AdminLayout>
  );
}
