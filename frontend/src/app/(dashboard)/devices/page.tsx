'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Smartphone, Tablet, Monitor, Tv, Watch, Glasses } from 'lucide-react';

const DEVICE_ICONS: Record<string, React.ElementType> = {
  iPhone: Smartphone, iPad: Tablet, Mac: Monitor,
  AppleTV: Tv, AppleWatch: Watch, VisionPro: Glasses,
};

const statusLabels: Record<string, string> = {
  pending: '待注册', enrolled: '已注册', unenrolled: '已注销',
};

const deviceTypes = ['', 'iPhone', 'iPad', 'Mac', 'AppleTV', 'AppleWatch', 'VisionPro'];

export default function DevicesPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deviceType, setDeviceType] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (deviceType) params.set('deviceType', deviceType);
    api.get(`/api/devices?${params}`).then(res => {
      setDevices(res.data.devices || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page, search, deviceType]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">设备管理</h1>
        <span className="text-sm text-muted-foreground">共 {total} 台设备</span>
      </div>

      <div className="flex gap-4">
        <Input placeholder="搜索设备名称、序列号..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
        <select value={deviceType} onChange={e => { setDeviceType(e.target.value); setPage(1); }} className="border rounded-md px-3 py-2 text-sm">
          <option value="">全部类型</option>
          {deviceTypes.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-3 text-left">设备名称</th>
                <th className="p-3 text-left">类型</th>
                <th className="p-3 text-left">序列号</th>
                <th className="p-3 text-left">系统版本</th>
                <th className="p-3 text-left">状态</th>
                <th className="p-3 text-left">分配人</th>
                <th className="p-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d: any) => {
                const Icon = DEVICE_ICONS[d.deviceType] || Smartphone;
                return (
                  <tr key={d.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{d.deviceName || '-'}</td>
                    <td className="p-3 flex items-center gap-2"><Icon className="h-4 w-4" />{d.deviceType}</td>
                    <td className="p-3 font-mono text-xs">{d.serialNumber}</td>
                    <td className="p-3">{d.osVersion || '-'}</td>
                    <td className="p-3"><Badge variant={d.enrollmentStatus === 'enrolled' ? 'default' : 'secondary'}>{statusLabels[d.enrollmentStatus] || d.enrollmentStatus}</Badge></td>
                    <td className="p-3">{d.asset?.assignedTo || '-'}</td>
                    <td className="p-3"><Link href={`/devices/${d.id}`}><Button variant="ghost" size="sm">详情</Button></Link></td>
                  </tr>
                );
              })}
              {devices.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">暂无设备</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">第 {page} 页</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={devices.length < 20}>下一页</Button>
        </div>
      </div>
    </div>
  );
}
