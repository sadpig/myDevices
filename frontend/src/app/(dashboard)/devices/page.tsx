'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '@/hooks/use-debounce';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Smartphone } from 'lucide-react';
import { DEVICE_ICONS, DEVICE_TYPES } from '@/lib/constants';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';
import { useAuth } from '@/hooks/use-auth';

export default function DevicesPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const [devices, setDevices] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const debouncedSearch = useDebounce(search);
  const { sortBy, sortOrder, handleSort } = useSort('createdAt');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20', sortBy, sortOrder });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (deviceType) params.set('deviceType', deviceType);
    api.get(`/api/devices?${params}`).then(res => {
      setDevices(res.data.devices || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page, debouncedSearch, deviceType, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('devices.title')}</h1>
        <span className="text-sm text-muted-foreground">{t('devices.total', { count: total })}</span>
      </div>

      <div className="flex gap-4">
        <Input placeholder={t('devices.searchPlaceholder') + ' / UDID'} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
        <select value={deviceType} onChange={e => { setDeviceType(e.target.value); setPage(1); }} className="border rounded-md px-3 py-2 text-sm">
          <option value="">{t('common.allTypes')}</option>
          {DEVICE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <SortableHeader label={t('devices.name')} field="deviceName" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('devices.type')} field="deviceType" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('devices.serial')} field="serialNumber" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('devices.osVersion')} field="osVersion" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('devices.status')} field="enrollmentStatus" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('devices.lastOnline')} field="lastSeenAt" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <th className="p-3 text-left">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d: any) => {
                const Icon = DEVICE_ICONS[d.deviceType] || Smartphone;
                return (
                  <tr key={d.id} className="border-b hover:bg-muted/20">
                    <td className="p-3 font-medium">{d.deviceName || '-'}</td>
                    <td className="p-3"><span className="flex items-center gap-2"><Icon className="h-4 w-4" />{d.deviceType}</span></td>
                    <td className="p-3 font-mono text-xs">{d.serialNumber}</td>
                    <td className="p-3">{d.osVersion || '-'}</td>
                    <td className="p-3"><Badge variant={d.enrollmentStatus === 'enrolled' ? 'default' : 'secondary'}>{t('status.' + d.enrollmentStatus)}</Badge></td>
                    <td className="p-3">{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US') : '-'}</td>
                    <td className="p-3"><Link href={`/devices/${d.id}`}><Button variant="ghost" size="sm">{t('common.details')}</Button></Link></td>
                  </tr>
                );
              })}
              {devices.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">{t('devices.noDevices')}</td></tr>}
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
