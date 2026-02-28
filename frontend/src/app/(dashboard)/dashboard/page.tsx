'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Tablet, Monitor, Tv, Watch, Glasses } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const DEVICE_ICONS: Record<string, React.ElementType> = {
  iPhone: Smartphone, iPad: Tablet, Mac: Monitor,
  AppleTV: Tv, AppleWatch: Watch, VisionPro: Glasses,
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface Stats {
  byType: { deviceType: string; _count: number }[];
  byStatus: { enrollmentStatus: string; _count: number }[];
  total: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDevices, setRecentDevices] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/reports/devices').then(res => setStats(res.data)).catch(() => {});
    api.get('/api/devices?limit=5').then(res => setRecentDevices(res.data.devices || [])).catch(() => {});
  }, []);

  const statusLabels: Record<string, string> = {
    pending: '待注册', enrolled: '已注册', unenrolled: '已注销',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">设备总数</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.total ?? '-'}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">已注册</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats?.byStatus.find(s => s.enrollmentStatus === 'enrolled')?._count ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">待注册</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {stats?.byStatus.find(s => s.enrollmentStatus === 'pending')?._count ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>设备类型分布</CardTitle></CardHeader>
          <CardContent className="h-64">
            {stats?.byType && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.byType.map(d => ({ name: d.deviceType, value: d._count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {stats.byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>注册状态</CardTitle></CardHeader>
          <CardContent className="h-64">
            {stats?.byStatus && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byStatus.map(d => ({ name: statusLabels[d.enrollmentStatus] || d.enrollmentStatus, value: d._count }))}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>最近设备</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="p-2 text-left">设备名称</th>
                <th className="p-2 text-left">类型</th>
                <th className="p-2 text-left">序列号</th>
                <th className="p-2 text-left">系统版本</th>
                <th className="p-2 text-left">状态</th>
              </tr>
            </thead>
            <tbody>
              {recentDevices.map((d: any) => {
                const Icon = DEVICE_ICONS[d.deviceType] || Smartphone;
                return (
                  <tr key={d.id} className="border-b">
                    <td className="p-2">{d.deviceName || '-'}</td>
                    <td className="p-2 flex items-center gap-2"><Icon className="h-4 w-4" />{d.deviceType}</td>
                    <td className="p-2 font-mono text-xs">{d.serialNumber}</td>
                    <td className="p-2">{d.osVersion || '-'}</td>
                    <td className="p-2"><Badge variant={d.enrollmentStatus === 'enrolled' ? 'default' : 'secondary'}>{statusLabels[d.enrollmentStatus] || d.enrollmentStatus}</Badge></td>
                  </tr>
                );
              })}
              {recentDevices.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">暂无设备</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
