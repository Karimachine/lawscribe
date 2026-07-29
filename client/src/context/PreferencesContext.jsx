import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../lib/translations';

const THEME_KEY = 'lawscribe_theme';
const LANGUAGE_KEY = 'lawscribe_language';

const PreferencesContext = createContext(null);

function getInitialTheme() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null;
  if (stored === 'dark' || stored === 'light') return stored;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function getInitialLanguage() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_KEY) : null;
  return stored && translations[stored] ? stored : 'en';
}

export function PreferencesProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const t = useMemo(() => {
    const dict = translations[language] || translations.en;
    return (key) => dict[key] ?? translations.en[key] ?? key;
  }, [language]);

  const value = { theme, toggleTheme, setTheme, language, setLanguage, t };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
