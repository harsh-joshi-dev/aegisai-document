import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../api/client';
import { warmBackendAndRedirectToGoogle } from '../utils/oauthWarmup';

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
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkAuth = async () => {
    // If no JWT token in localStorage, skip the API call (user is not logged in)
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await apiClient.get('/api/auth/me');
      if (response.data.success) {
        setUser(response.data.user);
      } else {
        setUser(null);
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      setUser(null);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth callback, error params, and initial auth check in one effect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const authToken = urlParams.get('auth_token');

    if (error) {
      setAuthError(error);
      window.history.replaceState({}, '', window.location.pathname || '/');
      setLoading(false);
      return;
    }

    if (authToken) {
      // Exchange the one-time token for a JWT (via Vite proxy)
      window.history.replaceState({}, '', '/dashboard');
      apiClient.post('/api/auth/token-exchange', { token: authToken })
        .then((response) => {
          if (response.data.success && response.data.token) {
            // Store JWT in localStorage — all subsequent API calls will use it
            localStorage.setItem('auth_token', response.data.token);
            setUser(response.data.user);
          } else {
            setAuthError('auth_failed');
          }
        })
        .catch((err) => {
          console.error('Token exchange failed:', err);
          setAuthError('auth_failed');
        })
        .finally(() => setLoading(false));
      return;
    }

    // Normal page load — check if already authenticated
    checkAuth();
  }, []);

  const login = async () => {
    await warmBackendAndRedirectToGoogle();
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout', {});
      localStorage.removeItem('auth_token');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
    }
  };

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
