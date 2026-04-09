import AdminCard from './AdminCard';

function StatIcon({ tone = 'primary' }) {
  const paths = {
    primary: 'M5 13h4v6H5zm5-8h4v14h-4zm5 4h4v10h-4z',
    success: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.2 14.2-3.2-3.2 1.4-1.4 1.8 1.8 4.6-4.6 1.4 1.4Z',
    danger: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.2 13.8-1.4 1.4L12 13.4l-2.8 2.8-1.4-1.4 2.8-2.8-2.8-2.8 1.4-1.4 2.8 2.8 2.8-2.8 1.4 1.4-2.8 2.8Z',
    info: 'M12 2 2 7v6c0 5 3.4 9.7 10 11 6.6-1.3 10-6 10-11V7Zm1 14h-2v-2h2Zm0-4h-2V8h2Z',
  };

  return (
    <span className={`stat-card-icon stat-card-icon-${tone}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={paths[tone] || paths.primary} />
      </svg>
    </span>
  );
}

export default function StatCard({ label, value, subtitle, tone = 'primary' }) {
  return (
    <AdminCard className="stat-card-shell">
      <div className="stat-card">
        <div className="stat-card-header-row">
          <span className="stat-card-label">{label}</span>
          <StatIcon tone={tone} />
        </div>
        <strong className="stat-card-value">{value}</strong>
        {subtitle ? <span className="stat-card-subtext">{subtitle}</span> : null}
      </div>
    </AdminCard>
  );
}
