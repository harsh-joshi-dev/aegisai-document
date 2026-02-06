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
  login: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      // Redirect to Google OAuth - use full URL to bypass React Router
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      console.log('Initiating Google Login to:', `${apiUrl}/api/auth/google`);
      // Use window.location.replace to ensure React Router doesn't intercept
      window.location.replace(`${apiUrl}/api/auth/google`);
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to initiate login. Please check your configuration.');
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout', {}, { withCredentials: true });
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const authSuccess = urlParams.get('auth') === 'success';

    if (error) {
      console.error('Authentication error:', error);
      alert('Authentication failed. Please try again.');
      window.history.replaceState({}, '', '/');
      setLoading(false);
      return;
    }

    if (authSuccess) {
      // Clean up URL first
      window.history.replaceState({}, '', '/');
      // Check auth status
      checkAuth()
        .then(() => {
          // Auth check complete, user should be set
          // App will automatically show upload page
        })
        .catch((err) => {
          console.error('Auth check error:', err);
          setLoading(false);
        });
    } else {
      // If not a callback, just finish loading
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
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
