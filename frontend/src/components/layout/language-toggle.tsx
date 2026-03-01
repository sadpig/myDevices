'use client';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/providers/preferences-provider';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const { syncPreference } = usePreferences();

  const toggle = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh';
    syncPreference('language', next);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 rounded-full px-2 text-xs font-medium"
      onClick={toggle}
    >
      {i18n.language === 'zh' ? 'En' : '中'}
    </Button>
  );
}
