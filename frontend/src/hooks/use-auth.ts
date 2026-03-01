'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface UserRole {
  id: string;
  code: string;
  name: string;
  dataScope: string;
}

interface UserDepartment {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: UserDepartment | null;
  permissions: string[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.post('/api/auth/logout').catch(() => {});
    }
    localStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/api/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    router.push('/dashboard');
  }, [router]);

  const hasPermission = useCallback((code: string) => {
    return user?.permissions?.includes(code) ?? false;
  }, [user]);

  const hasAnyPermission = useCallback((...codes: string[]) => {
    return codes.some(code => user?.permissions?.includes(code));
  }, [user]);

  return { user, loading, login, logout, hasPermission, hasAnyPermission };
}
