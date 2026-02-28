'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    api.get('/api/auth/me').then(res => setUser(res.data)).catch(() => {
      localStorage.removeItem('token');
      router.push('/login');
    });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">加载中...</div>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header onLogout={handleLogout} userName={user.name} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
