'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Smartphone, Package, Shield,
  ScrollText, BarChart3, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  { href: '/devices', labelKey: 'sidebar.devices', icon: Smartphone },
  { href: '/assets', labelKey: 'sidebar.assets', icon: Package },
  { href: '/profiles', labelKey: 'sidebar.profiles', icon: Shield },
  { href: '/audit-logs', labelKey: 'sidebar.auditLogs', icon: ScrollText },
  { href: '/reports', labelKey: 'sidebar.reports', icon: BarChart3 },
  { href: '/settings', labelKey: 'sidebar.settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  return (
    <aside className="w-64 border-r border-border bg-sidebar glass min-h-screen p-4">
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold">{t('app.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('app.subtitle')}</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
              pathname.startsWith(item.href)
                ? 'bg-primary/15 text-primary font-medium border-l-2 border-primary'
                : 'text-muted-foreground hover:bg-white/10 dark:hover:bg-white/5'
            )}
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
