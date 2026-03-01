'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LogOut, Bell } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from './language-toggle';
import api from '@/lib/api';

interface HeaderProps {
  onLogout: () => void;
  userName?: string;
}

export function Header({ onLogout, userName }: HeaderProps) {
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    const fetchCount = () => {
      api.get('/api/notifications/unread-count').then(res => setUnreadCount(res.data.count)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleNotifs = async () => {
    if (!showNotifs) {
      const res = await api.get('/api/notifications?limit=10').catch(() => null);
      if (res) setNotifs(res.data.notifications || []);
    }
    setShowNotifs(!showNotifs);
  };

  const markAllRead = async () => {
    await api.put('/api/notifications/read-all').catch(() => {});
    setUnreadCount(0);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <header className="h-14 border-b border-border bg-card/50 glass-subtle flex items-center justify-between px-6 sticky top-0 z-10">
      <div />
      <div className="flex items-center gap-3">
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={toggleNotifs} className="relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          {showNotifs && (
            <div className="absolute right-0 top-10 w-80 bg-card border rounded-lg shadow-lg z-50 max-h-96 overflow-auto">
              <div className="flex items-center justify-between p-3 border-b">
                <span className="text-sm font-medium">{t('notifications.title')}</span>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={markAllRead}>
                    {t('notifications.markAllRead')}
                  </Button>
                )}
              </div>
              {notifs.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">{t('notifications.empty')}</div>
              ) : (
                notifs.map(n => (
                  <div key={n.id} className={`p-3 border-b text-sm ${n.read ? 'opacity-60' : ''}`}>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{n.content}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
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
