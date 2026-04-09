import { useMemo, useState } from 'react';
import AdminButton from './AdminButton';
import DataTable from './DataTable';

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '--';
  }

  return parsed.toLocaleDateString();
};

const StatusBadge = ({ status }) => (
  <span className={`status-badge status-${status}`}>
    {status}
  </span>
);

export default function UsersTable({
  users,
  onToggleBlock,
  onViewUser,
  busyUserId,
  isLoading = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return users;
    }

    return users.filter((user) => (
      [user.name, user.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    ));
  }, [searchQuery, users]);

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (user) => (
        <div className="user-cell">
          <div className="user-cell-avatar">
            {String(user.name || user.fullName || 'U').trim().charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{user.name || user.fullName || 'Unnamed User'}</strong>
            <span>{user.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => <StatusBadge status={user.status} />,
    },
    {
      key: 'role',
      header: 'Details',
      render: (user) => (
        <div className="table-meta">
          <strong>{user.status === 'blocked' ? 'Restricted' : 'Active account'}</strong>
          <span>Joined {formatDate(user.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user) => (
        <div className="table-actions">
          <AdminButton variant="ghost" onClick={() => onViewUser?.(user)}>
            View
          </AdminButton>
          <AdminButton
            variant={user.status === 'blocked' ? 'success' : 'danger'}
            onClick={() => onToggleBlock(user)}
            disabled={busyUserId === user.id}
          >
            {busyUserId === user.id
              ? 'Working...'
              : user.status === 'blocked'
                ? 'Unblock'
                : 'Block'}
          </AdminButton>
        </div>
      ),
    },
  ];

  return (
    <div className="users-table-stack">
      <div className="users-toolbar">
        <div className="users-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 4a6 6 0 1 0 3.87 10.59l4.27 4.27 1.41-1.41-4.27-4.27A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or email"
            className="users-search-input"
          />
        </div>
        <div className="users-toolbar-meta">
          <span>{filteredUsers.length} visible</span>
          <span>{isLoading ? 'Loading...' : `${users.length} on this page`}</span>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredUsers}
        emptyMessage={isLoading ? 'Loading users...' : 'No users found.'}
      />
    </div>
  );
}
