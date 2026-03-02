import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'dark' | 'light';

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'aegis_theme';
const FORCE_DARK_THEME = true;

function getInitialTheme(): Theme {
  if (FORCE_DARK_THEME) return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return 'dark';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (FORCE_DARK_THEME || theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const activeTheme: Theme = FORCE_DARK_THEME ? 'dark' : theme;
    applyTheme(activeTheme);
    try {
      localStorage.setItem(STORAGE_KEY, activeTheme);
    } catch {}
  }, [theme]);

  const toggle = useCallback(() => {
    if (FORCE_DARK_THEME) {
      setThemeState('dark');
      return;
    }
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((t: Theme) => {
    if (FORCE_DARK_THEME) {
      setThemeState('dark');
      return;
    }
    setThemeState(t);
  }, []);

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
