import { useState } from 'react';
import AdminButton from './AdminButton';
import AdminCard from './AdminCard';
import AdminInput from './AdminInput';

export default function LoginForm({ onSubmit, isSubmitting, error }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const handleChange = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="auth-panel">
      <div className="auth-copy">
        <p className="auth-eyebrow">Premium admin workspace</p>
        <h1>Command the Amanat platform with clarity.</h1>
        <p>
          Review user health, emergency readiness, and access posture from a single secure
          dashboard built for operators.
        </p>
        <div className="auth-feature-list">
          <div className="auth-feature-item">
            <strong>Secure access</strong>
            <span>Role-validated admin login with persistent sessions.</span>
          </div>
          <div className="auth-feature-item">
            <strong>Operational visibility</strong>
            <span>Track active, blocked, and reachable accounts in real time.</span>
          </div>
        </div>
      </div>

      <AdminCard
        className="auth-card"
        title="Admin Login"
        subtitle="Restricted access for Amanat administrators only."
      >
        <form className="admin-form" onSubmit={handleSubmit}>
          <AdminInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => handleChange('email', event.target.value)}
            placeholder="Enter admin email"
            autoComplete="email"
          />

          <AdminInput
            label="Password"
            type="password"
            value={form.password}
            onChange={(event) => handleChange('password', event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
          />

          {error ? <p className="admin-error">{error}</p> : null}

          <AdminButton type="submit" disabled={isSubmitting} className="admin-button-wide">
            {isSubmitting ? (
              <span className="button-content">
                <span className="button-spinner" aria-hidden="true" />
                Signing in...
              </span>
            ) : (
              'Login'
            )}
          </AdminButton>
        </form>
      </AdminCard>
    </div>
  );
}
