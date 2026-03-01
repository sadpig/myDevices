'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export default function AppsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [apps, setApps] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const canWrite = hasPermission('app:write');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    api.get(`/api/apps?${params}`).then(res => {
      setApps(res.data.apps || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page, search, category]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('apps.deleteConfirm', { name }))) return;
    try {
      await api.delete(`/api/apps/${id}`);
      setApps(prev => prev.filter(a => a.id !== id));
      setTotal(prev => prev - 1);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('apps.title')}</h1>
        {canWrite && <Link href="/apps/new"><Button>{t('apps.new')}</Button></Link>}
      </div>

      <div className="flex gap-4">
        <Input placeholder={t('apps.searchPlaceholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} className="border rounded-md px-3 py-2 text-sm bg-background text-foreground">
          <option value="">{t('apps.allCategories', 'All Categories')}</option>
          {['productivity', 'utility', 'education', 'business', 'other'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 text-left">{t('apps.name')}</th>
                <th className="p-3 text-left">{t('apps.bundleId')}</th>
                <th className="p-3 text-left">{t('apps.version')}</th>
                <th className="p-3 text-left">{t('apps.category')}</th>
                <th className="p-3 text-left">{t('apps.managedApp')}</th>
                <th className="p-3 text-left">{t('apps.installCount')}</th>
                <th className="p-3 text-left">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app: any) => (
                <tr key={app.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 font-medium">{app.name}</td>
                  <td className="p-3 font-mono text-xs">{app.bundleId}</td>
                  <td className="p-3">{app.version || '-'}</td>
                  <td className="p-3">{app.category || '-'}</td>
                  <td className="p-3"><Badge variant={app.managedApp ? 'default' : 'secondary'}>{app.managedApp ? 'Yes' : 'No'}</Badge></td>
                  <td className="p-3">{app._count?.assignments ?? 0}</td>
                  <td className="p-3 space-x-2">
                    <Link href={`/apps/${app.id}`}><Button variant="ghost" size="sm">{t('common.details')}</Button></Link>
                    {canWrite && (
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(app.id, app.name)}>{t('common.delete')}</Button>
                    )}
                  </td>
                </tr>
              ))}
              {apps.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">{t('apps.noApps')}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{t('devices.pageInfo', { total, page, pages: Math.max(1, Math.ceil(total / 20)) })}</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>{t('common.prev')}</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>{t('common.next')}</Button>
        </div>
      </div>
    </div>
  );
}
