import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CaseStudiesPage from './pages/CaseStudiesPage';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import DecisionDashboardPage from './pages/DecisionDashboardPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import RulesPage from './pages/RulesPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import VendorLinksPage from './pages/VendorLinksPage';
import VendorLinkDetailPage from './pages/VendorLinkDetailPage';
import VendorPortalPage from './pages/VendorPortalPage';
import VendorProfilePage from './pages/VendorProfilePage';
import GstCompliancePage from './pages/GstCompliancePage';
import PricingPage from './pages/PricingPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import ContactPage from './pages/ContactPage';
import IntegrationsPage from './pages/IntegrationsPage';
import AuditLogPage from './pages/AuditLogPage';
import BlogPage from './pages/BlogPage';
import CareersPage from './pages/CareersPage';
import AboutPage from './pages/AboutPage';
import { AppLayout } from './layout/AppLayout';
import { AuthProvider, useAuth } from './state/auth';
import { WorkspaceProvider } from './state/workspace';
import { StoreProvider } from './state/store';
import { ToastProvider } from './state/toast';
import { ThemeProvider } from './state/theme';
import ScrollToTop from './components/ScrollToTop';

function ProtectedAppShell() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  const onboarded = (() => {
    try {
      const key = user?.id ? `ca_dynamix_onboarded_v1:${user.id}` : 'ca_dynamix_onboarded_v1';
      return localStorage.getItem(key) === 'true';
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
        <Route path="/gst-compliance" element={<GstCompliancePage />} />
        <Route path="/vendor-links" element={<VendorLinksPage />} />
        <Route path="/vendor-links/:linkId" element={<VendorLinkDetailPage />} />
        <Route path="/vendor-profile/:vendorKey" element={<VendorProfilePage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

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
      <Route path="/vendor-portal/:token" element={<VendorPortalPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/integrations" element={<IntegrationsPage />} />
      <Route path="/case-studies" element={<CaseStudiesPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/careers" element={<CareersPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/*" element={<ProtectedAppShell />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <StoreProvider>
              <ScrollToTop />
              <AppRoutes />
            </StoreProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
