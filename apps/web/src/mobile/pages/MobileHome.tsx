import { Link } from 'react-router-dom';

export default function MobileHome() {
  return (
    <div>
      <div className="m-page-title">
        <h1>Dashboard</h1>
      </div>

      <div className="m-card">
        <h3 className="m-card-title">Quick Actions</h3>
        <div className="m-actions-grid">
          <Link to="/m/scan" className="m-action-btn primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 4" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Scan Document</span>
          </Link>
          <Link to="/m/docs" className="m-action-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>My Docs</span>
          </Link>
          <Link to="/m/chat" className="m-action-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>AI Chat</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
