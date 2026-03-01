'use client';
import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ASSET_STATUS_LABELS, ASSET_STATUS_VARIANT } from '@/lib/constants';

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    api.get(`/api/assets?${params}`).then(res => {
      setAssets(res.data.assets || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page, debouncedSearch, status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">资产管理</h1>
        <Link href="/assets/new"><Button>新建资产</Button></Link>
      </div>

      <div className="flex gap-4">
        <Input placeholder="搜索分配人、位置、序列号..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="border rounded-md px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-3 text-left">设备</th>
                <th className="p-3 text-left">序列号</th>
                <th className="p-3 text-left">分配人</th>
                <th className="p-3 text-left">部门</th>
                <th className="p-3 text-left">状态</th>
                <th className="p-3 text-left">保修截止</th>
                <th className="p-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a: any) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{a.device?.deviceName || a.device?.modelName || '-'}</td>
                  <td className="p-3 font-mono text-xs">{a.device?.serialNumber || '-'}</td>
                  <td className="p-3">{a.assignedTo || '-'}</td>
                  <td className="p-3">{a.department || '-'}</td>
                  <td className="p-3"><Badge variant={ASSET_STATUS_VARIANT[a.status] || 'secondary'}>{ASSET_STATUS_LABELS[a.status] || a.status}</Badge></td>
                  <td className="p-3">{a.warrantyEnd ? new Date(a.warrantyEnd).toLocaleDateString('zh-CN') : '-'}</td>
                  <td className="p-3"><Link href={`/assets/${a.id}`}><Button variant="ghost" size="sm">详情</Button></Link></td>
                </tr>
              ))}
              {assets.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">暂无资产</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">共 {total} 条 · 第 {page}/{Math.max(1, Math.ceil(total / 20))} 页</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>下一页</Button>
        </div>
      </div>
    </div>
  );
}
