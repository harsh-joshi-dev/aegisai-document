import { NavLink } from 'react-router-dom';

function TabIcon({ name, isActive }: { name: 'home' | 'scan' | 'docs'; isActive?: boolean }) {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V11z" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
    case 'scan':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 4" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'docs':
      return (
        <svg viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      );
  }
}

export default function MobileNav() {
  return (
    <nav className="m-nav" aria-label="Mobile navigation">
      <NavLink to="/m" end className={({ isActive }) => `m-tab ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <>
            <TabIcon name="home" isActive={isActive} />
            <span>Home</span>
          </>
        )}
      </NavLink>
      <NavLink to="/m/scan" className={({ isActive }) => `m-tab ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <>
            <TabIcon name="scan" isActive={isActive} />
            <span>Scan</span>
          </>
        )}
      </NavLink>
      <NavLink to="/m/docs" className={({ isActive }) => `m-tab ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <>
            <TabIcon name="docs" isActive={isActive} />
            <span>Docs</span>
          </>
        )}
      </NavLink>
    </nav>
  );
}

