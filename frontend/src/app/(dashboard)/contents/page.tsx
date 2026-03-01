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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const TYPE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  document: 'default', book: 'secondary', media: 'outline',
};

export default function ContentsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [contents, setContents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const canWrite = hasPermission('content:write');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    api.get(`/api/contents?${params}`).then(res => {
      setContents(res.data.contents || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page, search, type]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('contents.deleteConfirm', { name }))) return;
    try {
      await api.delete(`/api/contents/${id}`);
      setContents(prev => prev.filter(c => c.id !== id));
      setTotal(prev => prev - 1);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('contents.title')}</h1>
        {canWrite && <Link href="/contents/new"><Button>{t('contents.new')}</Button></Link>}
      </div>

      <div className="flex gap-4">
        <Input placeholder={t('contents.searchPlaceholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="border rounded-md px-3 py-2 text-sm bg-background text-foreground">
          <option value="">{t('common.allStatus', 'All Types')}</option>
          {['document', 'book', 'media'].map(t2 => (
            <option key={t2} value={t2}>{t(`contents.types.${t2}`)}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 text-left">{t('contents.name')}</th>
                <th className="p-3 text-left">{t('contents.type')}</th>
                <th className="p-3 text-left">{t('contents.fileSize')}</th>
                <th className="p-3 text-left">{t('contents.version')}</th>
                <th className="p-3 text-left">{t('contents.distributeCount')}</th>
                <th className="p-3 text-left">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {contents.map((c: any) => (
                <tr key={c.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3"><Badge variant={TYPE_VARIANTS[c.type] || 'secondary'}>{String(t(`contents.types.${c.type}`, { defaultValue: c.type }))}</Badge></td>
                  <td className="p-3 text-xs">{formatFileSize(c.fileSize)}</td>
                  <td className="p-3">{c.version || '-'}</td>
                  <td className="p-3">{c._count?.assignments ?? 0}</td>
                  <td className="p-3 space-x-2">
                    <Link href={`/contents/${c.id}`}><Button variant="ghost" size="sm">{t('common.details')}</Button></Link>
                    {canWrite && (
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(c.id, c.name)}>{t('common.delete')}</Button>
                    )}
                  </td>
                </tr>
              ))}
              {contents.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{t('contents.noContents')}</td></tr>}
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
