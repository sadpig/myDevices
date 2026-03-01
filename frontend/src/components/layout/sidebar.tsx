'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Smartphone, Package, Shield,
  ScrollText, BarChart3, Settings, Building2, Users, UserCog,
  AppWindow, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  permission?: string;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    labelKey: 'sidebar.overview',
    items: [
      { href: '/dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
    ],
  },
  {
    labelKey: 'sidebar.deviceAssets',
    items: [
      { href: '/devices', labelKey: 'sidebar.devices', icon: Smartphone, permission: 'device:read' },
      { href: '/assets', labelKey: 'sidebar.assets', icon: Package, permission: 'asset:read' },
      { href: '/profiles', labelKey: 'sidebar.profiles', icon: Shield, permission: 'profile:read' },
      { href: '/apps', labelKey: 'sidebar.apps', icon: AppWindow, permission: 'app:read' },
      { href: '/contents', labelKey: 'sidebar.contents', icon: FileText, permission: 'content:read' },
    ],
  },
  {
    labelKey: 'sidebar.organization',
    items: [
      { href: '/departments', labelKey: 'sidebar.departments', icon: Building2, permission: 'dept:read' },
      { href: '/users', labelKey: 'sidebar.users', icon: Users, permission: 'user:read' },
      { href: '/roles', labelKey: 'sidebar.roles', icon: UserCog, permission: 'role:read' },
    ],
  },
  {
    labelKey: 'sidebar.system',
    items: [
      { href: '/audit-logs', labelKey: 'sidebar.auditLogs', icon: ScrollText, permission: 'audit:read' },
      { href: '/reports', labelKey: 'sidebar.reports', icon: BarChart3, permission: 'report:read' },
      { href: '/settings', labelKey: 'sidebar.settings', icon: Settings, permission: 'settings:read' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { hasPermission } = useAuth();

  return (
    <aside className="w-64 border-r border-border bg-sidebar glass min-h-screen p-4">
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold">{t('app.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('app.subtitle')}</p>
      </div>
      <nav className="space-y-6">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            item => !item.permission || hasPermission(item.permission)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.labelKey}>
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t(group.labelKey)}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => (
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
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
