const menuItems = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
];

function MenuIcon({ itemKey }) {
  const icons = {
    dashboard: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 13h7V4H4v9Zm9 7h7V4h-7v16ZM4 20h7v-5H4v5Z" />
      </svg>
    ),
    users: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 1a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2c-3.33 0-6 1.34-6 3v1h12v-1c0-1.66-2.67-3-6-3Zm-8 0c-2.67 0-5 1.04-5 2.33V18h5v-1c0-.8.3-1.54.84-2.17A8.56 8.56 0 0 0 8 14Z" />
      </svg>
    ),
  };

  return icons[itemKey] || null;
}

export default function AdminLayout({
  title,
  subtitle,
  admin,
  onLogout,
  topbarActions,
  activeItem = 'dashboard',
  onNavigate,
  children,
}) {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand-block">
          <div className="brand-mark">A</div>
          <div>
            <p className="brand-eyebrow">Amanat Console</p>
            <h2 className="brand-title">Admin Control</h2>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Sidebar">
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sidebar-link ${activeItem === item.key ? 'is-active' : ''}`.trim()}
              onClick={() => onNavigate?.(item.key)}
            >
              <span className="sidebar-link-icon">
                <MenuIcon itemKey={item.key} />
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-card">
            <p className="sidebar-footer-title">System posture</p>
            <strong>Protected</strong>
            <span>Admin routes are isolated from the mobile experience.</span>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-kicker">Overview</p>
            <h1 className="page-title">{title}</h1>
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>

          <div className="dashboard-topbar-actions">
            {topbarActions}
            <div className="admin-profile-pill">
              <div className="admin-profile-avatar">
                {String(admin?.name || 'A').trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{admin?.name || 'Admin'}</strong>
                <span>{admin?.email || 'No email configured'}</span>
              </div>
            </div>
            <button type="button" className="logout-link" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  );
}
