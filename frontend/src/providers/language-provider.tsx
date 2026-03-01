'use client';
import { useEffect } from 'react';
import i18n from '@/i18n/config';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const updateLang = (lng: string) => {
      document.documentElement.lang = lng === 'zh' ? 'zh-CN' : 'en';
    };
    updateLang(i18n.language);
    i18n.on('languageChanged', updateLang);
    return () => { i18n.off('languageChanged', updateLang); };
  }, []);
  return <>{children}</>;
}
