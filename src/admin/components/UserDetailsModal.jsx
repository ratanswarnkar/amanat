import AdminButton from './AdminButton';

const formatDateTime = (value) => {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not available';
  }

  return parsed.toLocaleString();
};

const toInitials = (name) => {
  const parts = String(name || 'User')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'U';
};

function DetailRow({ label, value }) {
  return (
    <div className="modal-detail-row">
      <span>{label}</span>
      <strong>{value || 'Not available'}</strong>
    </div>
  );
}

export default function UserDetailsModal({
  user,
  isOpen,
  isLoading = false,
  error = '',
  onClose,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="admin-modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>

        <div className="admin-modal-header">
          <div className="admin-modal-avatar">{toInitials(user?.name)}</div>
          <div>
            <p className="admin-modal-kicker">User details</p>
            <h2 id="user-details-title">{user?.name || 'Unnamed User'}</h2>
            <p className="admin-modal-subtitle">{user?.email || 'No email available'}</p>
          </div>
        </div>

        {error ? <p className="admin-error">{error}</p> : null}

        {isLoading ? (
          <div className="admin-modal-loading">
            <span className="button-spinner" aria-hidden="true" />
            <span>Loading user details...</span>
          </div>
        ) : (
          <>
            <div className="admin-modal-badges">
              <span className={`status-badge status-${user?.status || 'active'}`}>
                {user?.status || 'active'}
              </span>
              <span className="admin-modal-badge-secondary">{user?.role || 'user'}</span>
            </div>

            <div className="admin-modal-grid">
              <DetailRow label="Name" value={user?.name || 'Unnamed User'} />
              <DetailRow label="Email" value={user?.email || 'No email'} />
              <DetailRow label="User ID" value={user?.id || 'Not available'} />
              <DetailRow label="Created At" value={formatDateTime(user?.createdAt)} />
              <DetailRow label="Phone" value={user?.phone && user.phone !== '--' ? user.phone : 'Not available'} />
              <DetailRow label="Last Login" value={formatDateTime(user?.lastLoginAt)} />
              <DetailRow
                label="Emergency Status"
                value={user?.emergencyStatus || 'Not available'}
              />
            </div>
          </>
        )}

        <div className="admin-modal-actions">
          <AdminButton variant="ghost" onClick={onClose}>
            Close
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
