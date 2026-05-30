import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'habit-tracker-theme';

export const themes = [
  {
    value: 'light',
    label: 'Light',
    description: 'Clean, bright, and close to the current look.',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Low-light mode with cooler surfaces and softer contrast.',
  },
  {
    value: 'paper',
    label: 'Paper',
    description: 'Warm, textured, and a little softer around the edges.',
  },
];

const ThemeContext = createContext(null);

function readStoredTheme() {
  if (typeof window === 'undefined') return 'light';

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (themes.some((theme) => theme.value === stored)) {
      return stored;
    }
  } catch {
    // Ignore storage failures and fall back to the default theme.
  }

  return document.documentElement.dataset.theme || 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures; the theme will still apply for this session.
    }
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    themes,
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
