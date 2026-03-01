'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
  user: { name: string; email: string } | null;
}

const TARGET_TYPES = ['Device', 'Asset', 'Profile', 'User', 'Certificate'];

export default function AuditLogsPage() {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { sortBy, sortOrder, handleSort } = useSort('createdAt');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50', sortBy, sortOrder });
    if (action) params.set('action', action);
    if (targetType) params.set('targetType', targetType);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    api.get(`/api/audit-logs?${params}`).then(res => {
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page, action, targetType, startDate, endDate, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('audit.title')}</h1>

      <div className="flex gap-4 flex-wrap">
        <Input placeholder={t('audit.filterByAction')} value={action} onChange={e => { setAction(e.target.value); setPage(1); }} className="max-w-sm" />
        <select value={targetType} onChange={e => { setTargetType(e.target.value); setPage(1); }} className="border rounded-md px-3 py-2 text-sm">
          <option value="">{t('audit.allTargetTypes')}</option>
          {TARGET_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
        <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} className="w-40" />
        <span className="self-center text-sm text-muted-foreground">{t('common.to')}</span>
        <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} className="w-40" />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <SortableHeader label={t('audit.time')} field="createdAt" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <th className="p-3 text-left">{t('audit.operator')}</th>
                <SortableHeader label={t('audit.action')} field="action" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('audit.targetType')} field="targetType" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <th className="p-3 text-left">{t('audit.targetId')}</th>
                <th className="p-3 text-left">{t('audit.ipAddress')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b">
                  <td className="p-3 text-xs">{new Date(log.createdAt).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US')}</td>
                  <td className="p-3">{log.user?.name || '-'}</td>
                  <td className="p-3"><Badge variant="outline">{log.action}</Badge></td>
                  <td className="p-3">{log.targetType || '-'}</td>
                  <td className="p-3 text-xs">{log.targetId ? log.targetId.slice(0, 8) : '-'}</td>
                  <td className="p-3 text-muted-foreground text-xs">{log.ipAddress || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{t('audit.noLogs')}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{t('audit.pageInfo', { total, page })}</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>{t('common.prev')}</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={logs.length < 50}>{t('common.next')}</Button>
        </div>
      </div>
    </div>
  );
}
