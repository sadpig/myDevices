'use client';
import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ASSET_STATUS_VARIANT } from '@/lib/constants';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';

export default function AssetsPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebounce(search);
  const { sortBy, sortOrder, handleSort } = useSort('createdAt');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20', sortBy, sortOrder });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    api.get(`/api/assets?${params}`).then(res => {
      setAssets(res.data.assets || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page, debouncedSearch, status, sortBy, sortOrder]);

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('assets.title')}</h1>
        {hasPermission('asset:write') && <Link href="/assets/new"><Button>{t('assets.new')}</Button></Link>}
      </div>

      <div className="flex gap-4">
        <Input placeholder={t('assets.searchPlaceholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="border rounded-md px-3 py-2 text-sm">
          <option value="">{t('common.allStatus')}</option>
          {(['in_use', 'in_stock', 'repairing', 'retired', 'lost'] as const).map(k => (
            <option key={k} value={k}>{t('assetStatus.' + k)}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 text-left">{t('assets.device')}</th>
                <th className="p-3 text-left">{t('assets.serial')}</th>
                <SortableHeader label={t('assets.assignedTo')} field="assignedTo" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('assets.department')} field="department" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('assets.status')} field="status" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('assets.warrantyEnd')} field="warrantyEnd" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('assets.createdAt')} field="createdAt" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <th className="p-3 text-left">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a: any) => (
                <tr key={a.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 font-medium">{a.device?.deviceName || a.device?.modelName || '-'}</td>
                  <td className="p-3 font-mono text-xs">{a.device?.serialNumber || '-'}</td>
                  <td className="p-3">{a.assignedUser?.name || '-'}</td>
                  <td className="p-3">{a.department?.name || '-'}</td>
                  <td className="p-3"><Badge variant={ASSET_STATUS_VARIANT[a.status] || 'secondary'}>{t('assetStatus.' + a.status)}</Badge></td>
                  <td className="p-3">{a.warrantyEnd ? new Date(a.warrantyEnd).toLocaleDateString(locale) : '-'}</td>
                  <td className="p-3 text-xs">{new Date(a.createdAt).toLocaleDateString(locale)}</td>
                  <td className="p-3"><Link href={`/assets/${a.id}`}><Button variant="ghost" size="sm">{t('common.details')}</Button></Link></td>
                </tr>
              ))}
              {assets.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">{t('assets.noAssets')}</td></tr>}
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
