'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';
import { useAuth } from '@/hooks/use-auth';

export default function ProfilesPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { sortBy, sortOrder, handleSort } = useSort('createdAt');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20', sortBy, sortOrder });
    if (search) params.set('search', search);
    api.get(`/api/profiles?${params}`).then(res => {
      setProfiles(res.data.profiles || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page, search, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('profiles.title')}</h1>
        {hasPermission('profile:write') && <Link href="/profiles/new"><Button>{t('common.new')}</Button></Link>}
      </div>

      <div className="flex gap-4">
        <Input placeholder={t('profiles.searchPlaceholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <SortableHeader label={t('profiles.name')} field="name" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('profiles.identifier')} field="identifier" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('profiles.payloadType')} field="payloadType" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <th className="p-3 text-left">{t('profiles.deviceCount')}</th>
                <SortableHeader label={t('profiles.createdAt')} field="createdAt" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <th className="p-3 text-left">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 font-mono text-xs">{p.identifier}</td>
                  <td className="p-3"><Badge variant="outline">{p.payloadType}</Badge></td>
                  <td className="p-3">{t('profiles.deviceUnit', { count: p._count?.devices ?? 0 })}</td>
                  <td className="p-3 text-xs">{new Date(p.createdAt).toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US')}</td>
                  <td className="p-3"><Link href={`/profiles/${p.id}`}><Button variant="ghost" size="sm">{t('common.details')}</Button></Link></td>
                </tr>
              ))}
              {profiles.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{t('profiles.noProfiles')}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{t('profiles.pageInfo', { total, page })}</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>{t('common.prev')}</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={profiles.length < 20}>{t('common.next')}</Button>
        </div>
      </div>
    </div>
  );
}
