import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

interface MockUser {
  name: string;
  email: string;
}

interface MockAuthContextValue {
  user: MockUser | null;
  isAuthenticated: boolean;
  login: (email: string, _password: string) => void;
  signup: (name: string, email: string, _password: string) => void;
  logout: () => void;
}

const MockAuthContext = createContext<MockAuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'aegis_mock_user';

function readInitialUser(): MockUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockUser) : null;
  } catch {
    return null;
  }
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(readInitialUser);

  const login = (email: string) => {
    const nextUser = { name: email.split('@')[0] || 'User', email };
    setUser(nextUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  };

  const signup = (name: string, email: string) => {
    const nextUser = { name: name.trim() || 'User', email };
    setUser(nextUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, login, signup, logout }),
    [user]
  );

  return <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>;
}

export function useMockAuth() {
  const ctx = useContext(MockAuthContext);
  if (!ctx) throw new Error('useMockAuth must be used within MockAuthProvider');
  return ctx;
}
