'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get(`/api/profiles?page=${page}&limit=20`).then(res => {
      setProfiles(res.data.profiles || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">配置描述文件</h1>
        <span className="text-sm text-muted-foreground">共 {total} 个</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-3 text-left">名称</th>
                <th className="p-3 text-left">标识符</th>
                <th className="p-3 text-left">载荷类型</th>
                <th className="p-3 text-left">已安装设备</th>
                <th className="p-3 text-left">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 font-mono text-xs">{p.identifier}</td>
                  <td className="p-3"><Badge variant="outline">{p.payloadType}</Badge></td>
                  <td className="p-3">{p._count?.devices ?? 0} 台</td>
                  <td className="p-3 text-xs">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</td>
                </tr>
              ))}
              {profiles.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">暂无配置描述文件</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">第 {page} 页</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={profiles.length < 20}>下一页</Button>
        </div>
      </div>
    </div>
  );
}
