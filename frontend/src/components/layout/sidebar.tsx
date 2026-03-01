'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Smartphone, Package, Shield,
  ScrollText, BarChart3, Settings, Building2, Users, UserCog
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: '概览',
    items: [
      { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard, permission: 'dashboard:view' },
    ],
  },
  {
    label: '设备资产',
    items: [
      { href: '/devices', label: '设备管理', icon: Smartphone, permission: 'device:read' },
      { href: '/assets', label: '资产管理', icon: Package, permission: 'asset:read' },
      { href: '/profiles', label: '配置描述文件', icon: Shield, permission: 'profile:read' },
    ],
  },
  {
    label: '组织管理',
    items: [
      { href: '/departments', label: '部门管理', icon: Building2, permission: 'dept:read' },
      { href: '/users', label: '人员管理', icon: Users, permission: 'user:read' },
      { href: '/roles', label: '角色管理', icon: UserCog, permission: 'role:read' },
    ],
  },
  {
    label: '系统',
    items: [
      { href: '/audit-logs', label: '审计日志', icon: ScrollText, permission: 'audit:read' },
      { href: '/reports', label: '报表中心', icon: BarChart3, permission: 'report:read' },
      { href: '/settings', label: '系统设置', icon: Settings, permission: 'settings:read' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  return (
    <aside className="w-64 border-r bg-gray-50/40 min-h-screen p-4">
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold">myDevices</h1>
        <p className="text-sm text-muted-foreground">Apple 设备管理</p>
      </div>
      <nav className="space-y-6">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            item => !item.permission || hasPermission(item.permission)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      pathname.startsWith(item.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
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
