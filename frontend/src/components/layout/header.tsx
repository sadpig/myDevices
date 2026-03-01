'use client';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from './language-toggle';

interface HeaderProps {
  onLogout: () => void;
  userName?: string;
}

export function Header({ onLogout, userName }: HeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="h-14 border-b border-border bg-card/50 glass-subtle flex items-center justify-between px-6 sticky top-0 z-10">
      <div />
      <div className="flex items-center gap-3">
        <LanguageToggle />
        <ThemeToggle />
        {userName && <span className="text-sm text-muted-foreground">{userName}</span>}
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          {t('common.logout')}
        </Button>
      </div>
    </header>
  );
}
