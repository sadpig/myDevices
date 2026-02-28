'use client';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  onLogout: () => void;
  userName?: string;
}

export function Header({ onLogout, userName }: HeaderProps) {
  return (
    <header className="h-14 border-b flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        {userName && <span className="text-sm text-muted-foreground">{userName}</span>}
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          退出
        </Button>
      </div>
    </header>
  );
}
