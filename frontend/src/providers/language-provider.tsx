'use client';
import { useEffect } from 'react';
import '@/i18n/config';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // i18n is initialized by importing config
  }, []);
  return <>{children}</>;
}
