import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MobileNav from './MobileNav';
import './mobile.css';

export default function MobileLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="m-app">
      <header className="m-header">
        <Link to="/m" className="m-header-logo">
          <svg className="m-header-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Aegis AI</span>
        </Link>
        <div className="m-header-actions">
          {user?.name && (
            <span className="m-header-user" title={user.email}>
              {user.name.split(/\s+/)[0]}
            </span>
          )}
          <button
            type="button"
            className="m-header-logout"
            onClick={() => logout()}
            aria-label="Log out"
            title="Log out"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </header>
      <div className="m-content">
        <Outlet />
      </div>
      <MobileNav />
    </div>
  );
}

