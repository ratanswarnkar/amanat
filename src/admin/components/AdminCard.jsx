export default function AdminCard({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`admin-card ${className}`.trim()}>
      {(title || subtitle || actions) ? (
        <div className="admin-card-header">
          <div>
            {title ? <h3 className="admin-card-title">{title}</h3> : null}
            {subtitle ? <p className="admin-card-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="admin-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="admin-card-body">{children}</div>
    </section>
  );
}
