'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Tablet, Monitor, Tv, Watch, Glasses, PackageCheck, Package, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const DEVICE_ICONS: Record<string, React.ElementType> = {
  iPhone: Smartphone, iPad: Tablet, Mac: Monitor,
  AppleTV: Tv, AppleWatch: Watch, VisionPro: Glasses,
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#d0743c'];

const STATUS_COLORS: Record<string, string> = {
  in_use: '#00C49F', in_stock: '#0088FE', repairing: '#FFBB28', retired: '#8884D8', lost: '#FF8042',
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const [dashStats, setDashStats] = useState<any>(null);
  const [recentDevices, setRecentDevices] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/reports/dashboard-stats').then(res => setDashStats(res.data)).catch(() => {});
    api.get('/api/devices?limit=5').then(res => setRecentDevices(res.data.devices || [])).catch(() => {});
  }, []);

  const ds = dashStats?.deviceStats;
  const as = dashStats?.assetStats;

  const enrolledCount = ds?.byStatus?.find((s: any) => s.enrollmentStatus === 'enrolled')?._count ?? 0;
  const pendingCount = ds?.byStatus?.find((s: any) => s.enrollmentStatus === 'pending')?._count ?? 0;

  const statusLabels: Record<string, string> = {
    pending: t('status.pending'), enrolled: t('status.enrolled'), unenrolled: t('status.unenrolled'),
  };

  const assetStatusData = (as?.byStatus || []).map((s: any) => ({
    name: t('assetStatus.' + s.status),
    value: s._count,
    fill: STATUS_COLORS[s.status] || '#ccc',
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('dashboard.totalDevices')}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{ds?.total ?? '-'}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('dashboard.enrolled')}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 flex items-center gap-2">
              <PackageCheck className="h-6 w-6" />{enrolledCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('dashboard.totalAssets')}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />{as?.total ?? '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('dashboard.pending')}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />{pendingCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Device type distribution */}
        <Card>
          <CardHeader><CardTitle>{t('dashboard.deviceTypeDistribution')}</CardTitle></CardHeader>
          <CardContent className="h-64">
            {ds?.byType && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ds.byType.map((d: any) => ({ name: d.deviceType, value: d._count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {ds.byType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Asset status distribution */}
        <Card>
          <CardHeader><CardTitle>{t('dashboard.assetStatusDistribution')}</CardTitle></CardHeader>
          <CardContent className="h-64">
            {assetStatusData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={assetStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {assetStatusData.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department asset distribution */}
      {dashStats?.assetByDept?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t('dashboard.assetByDepartment')}</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashStats.assetByDept} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent devices table */}
      <Card>
        <CardHeader><CardTitle>{t('dashboard.recentDevices')}</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="p-2 text-left">{t('dashboard.deviceName')}</th>
                <th className="p-2 text-left">{t('dashboard.type')}</th>
                <th className="p-2 text-left">{t('dashboard.serial')}</th>
                <th className="p-2 text-left">{t('dashboard.osVersion')}</th>
                <th className="p-2 text-left">{t('dashboard.status')}</th>
              </tr>
            </thead>
            <tbody>
              {recentDevices.map((d: any) => {
                const Icon = DEVICE_ICONS[d.deviceType] || Smartphone;
                return (
                  <tr key={d.id} className="border-b hover:bg-muted/20">
                    <td className="p-2">{d.deviceName || '-'}</td>
                    <td className="p-2 flex items-center gap-2"><Icon className="h-4 w-4" />{d.deviceType}</td>
                    <td className="p-2 font-mono text-xs">{d.serialNumber}</td>
                    <td className="p-2">{d.osVersion || '-'}</td>
                    <td className="p-2"><Badge variant={d.enrollmentStatus === 'enrolled' ? 'default' : 'secondary'}>{statusLabels[d.enrollmentStatus] || d.enrollmentStatus}</Badge></td>
                  </tr>
                );
              })}
              {recentDevices.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{t('dashboard.noDevices')}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
