import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { exchangeAuthToken, getMe, logout as apiLogout, type AuthUser } from '../api/client';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Starts real login (Google OAuth). */
  login: () => void;
  /** Clears local token and (best-effort) logs out backend session. */
  logout: () => Promise<void>;
  /** Re-fetch current user from backend (if token exists). */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const ONE_TIME_EXCHANGED_PREFIX = 'aegis_auth_token_exchanged_v1:';
const ONE_TIME_STATE_PREFIX = 'aegis_auth_token_exchange_state_v1:';

type ExchangeState = 'pending' | 'done';

function getExchangeState(token: string): ExchangeState | null {
  try {
    const v = sessionStorage.getItem(`${ONE_TIME_STATE_PREFIX}${token}`);
    if (v === 'pending' || v === 'done') return v;
    return null;
  } catch {
    return null;
  }
}

function setExchangeState(token: string, state: ExchangeState) {
  try {
    sessionStorage.setItem(`${ONE_TIME_STATE_PREFIX}${token}`, state);
  } catch {
    // ignore
  }
}

function clearExchangeState(token: string) {
  try {
    sessionStorage.removeItem(`${ONE_TIME_STATE_PREFIX}${token}`);
  } catch {
    // ignore
  }
}

function wasOneTimeTokenExchanged(token: string): boolean {
  try {
    return sessionStorage.getItem(`${ONE_TIME_EXCHANGED_PREFIX}${token}`) === '1';
  } catch {
    return false;
  }
}

function markOneTimeTokenExchanged(token: string) {
  try {
    sessionStorage.setItem(`${ONE_TIME_EXCHANGED_PREFIX}${token}`, '1');
  } catch {
    // ignore
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

function getUrlParam(name: string): string | null {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  } catch {
    return null;
  }
}

function removeUrlParam(name: string) {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has(name)) return;
    u.searchParams.delete(name);
    window.history.replaceState({}, '', u.toString());
  } catch {
    // ignore
  }
}

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booted, setBooted] = useState(false);

  const refresh = useCallback(async () => {
    const token = readToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await getMe();
      setUser(me.user);
    } catch {
      // Token may be invalid/expired.
      writeToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // If coming back from Google OAuth callback, backend redirects with ?auth_token=...
      const oneTime = getUrlParam('auth_token');
      if (oneTime) {
        // React 18 StrictMode runs effects twice in dev; token-exchange is single-use.
        // Also, token-exchange can fail if backend is temporarily down (port conflict etc.).
        // Strategy:
        // - Mark state "pending" during exchange.
        // - Mark "done" only after we have a real JWT stored.
        // - Only remove auth_token from URL once we have a JWT (or exchange is done).
        const state = getExchangeState(oneTime);
        const alreadyDone = state === 'done' || wasOneTimeTokenExchanged(oneTime);

        if (alreadyDone) {
          await refresh();
          if (readToken()) removeUrlParam('auth_token');
        } else if (state === 'pending') {
          // Another mount/run started the exchange; wait briefly for JWT to appear.
          for (let i = 0; i < 20; i++) {
            if (readToken()) break;
            await sleep(100);
          }
          await refresh();
          if (readToken()) removeUrlParam('auth_token');
        } else {
          setExchangeState(oneTime, 'pending');
          try {
            const exchanged = await exchangeAuthToken(oneTime);
            writeToken(exchanged.token);
            markOneTimeTokenExchanged(oneTime);
            setExchangeState(oneTime, 'done');
            if (!cancelled) setUser(exchanged.user);
            removeUrlParam('auth_token');
          } catch {
            // Allow retry if backend was down: keep URL param if we don't have a JWT yet.
            clearExchangeState(oneTime);
            const existing = readToken();
            if (!existing) {
              writeToken(null);
              if (!cancelled) setUser(null);
              // Do NOT remove auth_token, so a refresh can retry within TTL.
            } else {
              await refresh();
              removeUrlParam('auth_token');
            }
          }
        }
      } else {
        await refresh();
      }

      if (!cancelled) setBooted(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(() => {
    // Start Google OAuth via backend. (Proxy keeps same-origin in dev)
    window.location.href = '/api/auth/google';
  }, []);

  const logout = useCallback(async () => {
    writeToken(null);
    setUser(null);
    try {
      await apiLogout();
    } catch {
      // ignore (token-based auth doesn't require server-side logout)
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      login,
      logout,
      refresh,
    }),
    [user, login, logout, refresh]
  );

  // Prevent auth flicker during bootstrap
  if (!booted) return null;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

