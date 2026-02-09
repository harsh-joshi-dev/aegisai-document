import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      const response = await apiClient.get('/api/auth/me', {
        withCredentials: true,
      });
      if (response.data.success) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = () => {
    try {
      // Must redirect to the backend origin (e.g. localhost:3001), not the frontend.
      // Otherwise the browser stays on the app and React Router shows "No routes matched /api/auth/google".
      const backendOrigin =
        import.meta.env.VITE_BACKEND_URL ||
        import.meta.env.VITE_API_URL ||
        (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);
      const authUrl = `${backendOrigin.replace(/\/$/, '')}/api/auth/google`;
      console.log('Initiating Google Login to:', authUrl);
      window.location.replace(authUrl);
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to initiate login. Please check your configuration.');
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout', {}, { withCredentials: true });
      setUser(null);
      // Do not full-reload: let React re-render so mobile viewport is preserved.
      // App will redirect /m -> / when unauthenticated via routes.
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
    }
  };

  // Handle OAuth callback and error params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const authSuccess = urlParams.get('auth') === 'success';

    if (error) {
      setAuthError(error);
      window.history.replaceState({}, '', window.location.pathname || '/');
      setLoading(false);
      return;
    }

    if (authSuccess) {
      window.history.replaceState({}, '', '/');
      checkAuth()
        .then(() => {})
        .catch((err) => {
          console.error('Auth check error:', err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, authError, clearAuthError: () => setAuthError(null), login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
