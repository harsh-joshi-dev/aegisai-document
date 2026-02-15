import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import DecisionDashboardPage from './pages/DecisionDashboardPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import RulesPage from './pages/RulesPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import { AppLayout } from './layout/AppLayout';
import { MockAuthProvider, useMockAuth } from './state/mockAuth';
import { WorkspaceProvider } from './state/workspace';
import { MockStoreProvider } from './state/mockStore';
import { ToastProvider } from './state/toast';

function ProtectedAppShell() {
  const { isAuthenticated } = useMockAuth();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  const onboarded = (() => {
    try {
      return localStorage.getItem('aegis_onboarded_v1') === 'true';
    } catch {
      return false;
    }
  })();

  if (!onboarded) return <Navigate to="/onboarding" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/dashboard" element={<DecisionDashboardPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/document/:id" element={<DocumentDetailPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useMockAuth();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/onboarding"
        element={isAuthenticated ? <OnboardingPage /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/auth"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthPage />}
      />
      <Route path="/*" element={<ProtectedAppShell />} />
    </Routes>
  );
}

export default function App() {
  return (
    <MockAuthProvider>
      <ToastProvider>
        <MockStoreProvider>
          <WorkspaceProvider>
            <AppRoutes />
          </WorkspaceProvider>
        </MockStoreProvider>
      </ToastProvider>
    </MockAuthProvider>
  );
}
