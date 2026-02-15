import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen px-6 pt-24 pb-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>Settings</h1>
        <p className="text-muted">Manage your account preferences.</p>

        <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
          <h2 className="text-2xl" style={{ color: 'var(--text-main)' }}>Account</h2>
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ color: 'var(--text-main)', fontWeight: 700 }}>{user?.name}</div>
            <div className="text-muted" style={{ marginBottom: 0 }}>{user?.email}</div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-secondary" onClick={logout}>Log out</button>
          </div>
        </div>

        <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
          <h2 className="text-2xl" style={{ color: 'var(--text-main)' }}>AI</h2>
          <p className="text-muted">
            This MVP uses OpenAI for summaries and explanations when configured. If OpenAI is not configured, the app will use deterministic fallbacks.
          </p>
        </div>
      </div>
    </div>
  );
}
