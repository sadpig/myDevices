'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (action) params.set('action', action);
    api.get(`/api/audit-logs?${params}`).then(res => {
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page, action]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">审计日志</h1>

      <div className="flex gap-4">
        <Input placeholder="按操作类型筛选..." value={action} onChange={e => { setAction(e.target.value); setPage(1); }} className="max-w-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-3 text-left">时间</th>
                <th className="p-3 text-left">操作人</th>
                <th className="p-3 text-left">操作</th>
                <th className="p-3 text-left">目标</th>
                <th className="p-3 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b">
                  <td className="p-3 text-xs">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="p-3">{log.user?.name || '-'}</td>
                  <td className="p-3"><Badge variant="outline">{log.action}</Badge></td>
                  <td className="p-3 text-xs">{log.targetType}{log.targetId ? ` / ${log.targetId.slice(0, 8)}` : ''}</td>
                  <td className="p-3 text-muted-foreground text-xs">{log.ipAddress || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">暂无日志</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">共 {total} 条 · 第 {page} 页</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={logs.length < 50}>下一页</Button>
        </div>
      </div>
    </div>
  );
}
