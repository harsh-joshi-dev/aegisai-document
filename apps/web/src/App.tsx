import { useEffect } from 'react';
import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { LocationProvider } from './contexts/LocationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import UploadPage from './pages/upload';
import ChatPage from './pages/chat';
import LandingPage from './pages/LandingPage';
import RiskTrendsDashboard from './components/dashboard/RiskTrendsDashboard';
import LoginPage from './components/LoginPage';
import PricingPage from './pages/PricingPage';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import NotFoundPage from './pages/NotFoundPage';
import SharedDocumentPage from './pages/SharedDocumentPage';
import CategoryNav from './components/CategoryNav';
import MobileLayout from './mobile/MobileLayout';
import MobileHome from './mobile/pages/MobileHome';
import MobileScan from './mobile/pages/MobileScan';
import MobileDocs from './mobile/pages/MobileDocs';
import MobileChat from './mobile/pages/MobileChat';
import MobileSettings from './mobile/pages/MobileSettings';
import { useIsMobile } from './mobile/useIsMobile';
import './App.css';

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button onClick={logout} className="logout-button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      Logout
    </button>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // If user is on a phone, default them into the mobile shell
  // (but still allow desktop routes when they explicitly navigate there)
  useEffect(() => {
    if (!user) return;
    if (!isMobile) return;
    if (location.pathname.startsWith('/m')) return;
    // Avoid redirect loops
    if (location.pathname === '/login') return;
    navigate('/m', { replace: true });
  }, [user, isMobile, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-main)' }}>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  // Don't let React Router handle /api/* routes - these should go to backend
  if (location.pathname.startsWith('/api/')) {
    return null; // Let the browser handle the redirect naturally
  }

  if (!user) {
    return (
      <div className={isMobile ? 'public-routes public-routes--mobile' : 'public-routes'}>
        <Routes>
          <Route path="/document/:documentId" element={<SharedDocumentPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/m" element={<Navigate to="/" replace />} />
          <Route path="/m/*" element={<Navigate to="/" replace />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    );
  }

  return (
    <LocationProvider>
      <div className="app">
        <nav className={`navbar ${isMobile ? 'navbar--hidden-on-mobile' : ''}`}>
          <div className="nav-container">
            <Link to="/" className="logo">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Aegis AI
            </Link>
            <div className="nav-links">
              <CategoryNav />
              <Link
                to="/"
                className={location.pathname === '/' ? 'active' : ''}
              >
                Upload
              </Link>
              <Link
                to="/chat"
                className={location.pathname === '/chat' ? 'active' : ''}
              >
                Chat
              </Link>
              <Link
                to="/dashboard"
                className={location.pathname === '/dashboard' ? 'active' : ''}
              >
                Dashboard
              </Link>
              <Link
                to="/pricing"
                className={location.pathname === '/pricing' ? 'active' : ''}
              >
                Pricing
              </Link>
              <div className="user-info">
                <img src={user.picture || '/default-avatar.png'} alt={user.name} className="user-avatar" />
                <span className="user-name">{user.name}</span>
                <LogoutButton />
              </div>
            </div>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/document/:documentId" element={<SharedDocumentPage />} />
            <Route path="/" element={<UploadPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/dashboard" element={<RiskTrendsDashboard />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/m" element={<MobileLayout />}>
              <Route index element={<MobileHome />} />
              <Route path="scan" element={<MobileScan />} />
              <Route path="docs" element={<MobileDocs />} />
              <Route path="chat" element={<MobileChat />} />
              <Route path="settings" element={<MobileSettings />} />
            </Route>
            <Route path="/mobile" element={<Navigate to="/m" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </LocationProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
