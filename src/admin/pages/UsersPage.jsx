import { useState } from 'react';
import AdminButton from '../components/AdminButton';
import AdminCard from '../components/AdminCard';
import AdminLayout from '../components/AdminLayout';
import UserDetailsModal from '../components/UserDetailsModal';
import UsersTable from '../components/UsersTable';
import { adminApi } from '../api/adminApi';

export default function UsersPage({
  admin,
  users,
  pagination,
  onToggleBlock,
  onPageChange,
  onLogout,
  onNavigate,
  error,
  isLoading,
  busyUserId,
}) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const currentPage = pagination?.page ?? 1;
  const pageSize = pagination?.limit ?? 10;
  const totalUsers = pagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));

  const handleViewUser = async (user) => {
    setSelectedUser(user);
    setDetailsError('');
    setIsDetailsLoading(true);

    try {
      const fullUser = await adminApi.getUserById(user.id);
      setSelectedUser(fullUser);
    } catch (viewError) {
      setDetailsError(viewError?.message || 'Unable to load user details.');
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setDetailsError('');
    setIsDetailsLoading(false);
  };

  return (
    <AdminLayout
      title="Users"
      subtitle="Manage user accounts, search records, and control block status from one focused workspace."
      admin={admin}
      onLogout={onLogout}
      activeItem="users"
      onNavigate={onNavigate}
    >
      {error ? <p className="admin-error">{error}</p> : null}

      <AdminCard
        className="admin-table-card"
        title="User Directory"
        subtitle={isLoading ? 'Loading users...' : 'Search and manage registered users.'}
        actions={(
          <div className="users-summary-pill">
            <span className="users-summary-dot" />
            <span>{totalUsers} total users</span>
          </div>
        )}
      >
        <UsersTable
          users={users}
          onToggleBlock={onToggleBlock}
          onViewUser={handleViewUser}
          busyUserId={busyUserId}
          isLoading={isLoading}
        />
        <div className="admin-pagination">
          <span className="admin-pagination-label">
            Page {currentPage} of {totalPages}
          </span>
          <div className="page-actions">
            <AdminButton
              variant="ghost"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={isLoading || currentPage <= 1}
            >
              Previous
            </AdminButton>
            <AdminButton
              variant="ghost"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={isLoading || currentPage >= totalPages}
            >
              Next
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      <UserDetailsModal
        user={selectedUser}
        isOpen={Boolean(selectedUser)}
        isLoading={isDetailsLoading}
        error={detailsError}
        onClose={handleCloseModal}
      />
    </AdminLayout>
  );
}
