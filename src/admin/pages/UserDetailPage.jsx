import AdminButton from '../components/AdminButton';
import AdminCard from '../components/AdminCard';
import AdminLayout from '../components/AdminLayout';
import StatCard from '../components/StatCard';

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '--';
  }

  return parsed.toLocaleString();
};

export default function UserDetailPage({
  admin,
  user,
  onBack,
  onLogout,
  onToggleBlock,
  error,
  isLoading,
  busyUserId,
}) {
  return (
    <AdminLayout
      title="User Detail"
      subtitle={`Reviewed by ${admin?.name || 'Admin'}. Inspect account identity, reachability, and access state.`}
      admin={admin}
      onLogout={onLogout}
      topbarActions={(
        <AdminButton variant="ghost" onClick={onBack}>
          Back
        </AdminButton>
      )}
    >
      {error ? <p className="admin-error">{error}</p> : null}

      <section className="stats-grid detail-stats-grid">
        <StatCard label="Account Role" value={user?.role || '--'} subtitle="Assigned access level" tone="primary" />
        <StatCard label="Mobile Verified" value={user?.isMobileVerified ? 'Yes' : 'No'} subtitle="Device reachability status" tone="success" />
        <StatCard label="Account State" value={user?.isActive === false ? 'Inactive' : 'Active'} subtitle="Current operational state" tone="info" />
      </section>

      <AdminCard
        className="detail-card"
        title={user?.name || 'User'}
        subtitle={isLoading ? 'Refreshing details...' : 'Individual account overview.'}
        actions={(
          <AdminButton
            variant={user?.status === 'blocked' ? 'success' : 'danger'}
            onClick={() => onToggleBlock(user)}
            disabled={busyUserId === user?.id}
          >
            {busyUserId === user?.id
              ? 'Working...'
              : user?.status === 'blocked'
                ? 'Unblock User'
                : 'Block User'}
          </AdminButton>
        )}
      >
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Phone</span>
            <strong>{user?.phone || '--'}</strong>
          </div>
          <div className="detail-item">
            <span className="detail-label">Status</span>
            <strong>{user?.status || '--'}</strong>
          </div>
          <div className="detail-item">
            <span className="detail-label">Role</span>
            <strong>{user?.role || '--'}</strong>
          </div>
          <div className="detail-item">
            <span className="detail-label">Created At</span>
            <strong>{formatDate(user?.createdAt)}</strong>
          </div>
          <div className="detail-item">
            <span className="detail-label">Email</span>
            <strong>{user?.email || '--'}</strong>
          </div>
        </div>
      </AdminCard>
    </AdminLayout>
  );
}
