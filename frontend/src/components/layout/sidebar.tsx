'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Smartphone, Package, Shield,
  ScrollText, BarChart3, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/devices', label: '设备管理', icon: Smartphone },
  { href: '/assets', label: '资产管理', icon: Package },
  { href: '/profiles', label: '配置描述文件', icon: Shield },
  { href: '/audit-logs', label: '审计日志', icon: ScrollText },
  { href: '/reports', label: '报表中心', icon: BarChart3 },
  { href: '/settings', label: '系统设置', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 border-r bg-gray-50/40 min-h-screen p-4">
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold">myDevices</h1>
        <p className="text-sm text-muted-foreground">Apple 设备管理</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
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
      </nav>
    </aside>
  );
}
