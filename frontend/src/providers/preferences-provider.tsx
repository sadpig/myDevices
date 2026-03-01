'use client';
import { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';

interface PreferencesContextType {
  syncPreference: (key: 'theme' | 'language', value: string) => void;
}

const PreferencesContext = createContext<PreferencesContextType>({
  syncPreference: () => {},
});

export const usePreferences = () => useContext(PreferencesContext);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const { i18n } = useTranslation();
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    api.get('/api/auth/me').then((res) => {
      const prefs = res.data.preferences;
      if (prefs?.theme) setTheme(prefs.theme);
      if (prefs?.language) {
        i18n.changeLanguage(prefs.language);
        localStorage.setItem('mydevices-language', prefs.language);
      }
    }).catch(() => {});
  }, [setTheme, i18n]);

  const syncPreference = useCallback((key: 'theme' | 'language', value: string) => {
    if (key === 'theme') setTheme(value);
    if (key === 'language') {
      i18n.changeLanguage(value);
      localStorage.setItem('mydevices-language', value);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const token = localStorage.getItem('token');
      if (token) {
        api.patch('/api/auth/me/preferences', { [key]: value }).catch(() => {});
      }
    }, 300);
  }, [setTheme, i18n]);

  return (
    <PreferencesContext.Provider value={{ syncPreference }}>
      {children}
    </PreferencesContext.Provider>
  );
}
