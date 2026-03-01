'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function ReportsPage() {
  const { t } = useTranslation();
  const [deviceStats, setDeviceStats] = useState<any>(null);
  const [assetStats, setAssetStats] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);

  const assetStatusLabels: Record<string, string> = {
    in_use: t('assetStatus.in_use'),
    in_stock: t('assetStatus.in_stock'),
    repairing: t('assetStatus.repairing'),
    retired: t('assetStatus.retired'),
    lost: t('assetStatus.lost'),
  };

  const downloadCsv = async (type: 'devices' | 'assets') => {
    try {
      const res = await api.get(`/api/reports/${type}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert(t('common.exportFailed'));
    }
  };

  useEffect(() => {
    api.get('/api/reports/devices').then(res => setDeviceStats(res.data)).catch(() => {});
    api.get('/api/reports/assets').then(res => setAssetStats(res.data)).catch(() => {});
    api.get('/api/reports/compliance').then(res => setCompliance(res.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('reports.title')}</h1>

      {compliance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reports.mdmEnrollRate')}</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-green-600">{compliance.enrollmentRate}%</div><p className="text-xs text-muted-foreground">{compliance.enrolled} / {compliance.totalDevices}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reports.supervisionRate')}</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-blue-600">{compliance.supervisionRate}%</div><p className="text-xs text-muted-foreground">{compliance.supervised} / {compliance.totalDevices}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reports.assetCoverageRate')}</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-purple-600">{compliance.assetCoverage}%</div><p className="text-xs text-muted-foreground">{compliance.withAsset} / {compliance.totalDevices}</p></CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices">{t('reports.deviceReport')}</TabsTrigger>
          <TabsTrigger value="assets">{t('reports.assetReport')}</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>{t('reports.deviceStats')}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCsv('devices')}>{t('common.exportCsv')}</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>{t('reports.deviceTypeDistribution')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                {deviceStats?.byType && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={deviceStats.byType.map((d: any) => ({ name: d.deviceType, value: d._count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {deviceStats.byType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t('reports.osVersionDistribution')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                {deviceStats?.byOS && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deviceStats.byOS.map((d: any) => ({ name: d.osVersion || t('reports.unknown'), value: d._count }))}>
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884D8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>{t('reports.assetStats')}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCsv('assets')}>{t('common.exportCsv')}</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>{t('reports.assetStatusDistribution')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                {assetStats?.byStatus && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={assetStats.byStatus.map((d: any) => ({ name: assetStatusLabels[d.status] || d.status, value: d._count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {assetStats.byStatus.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t('reports.departmentDistribution')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                {assetStats?.byDepartment && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assetStats.byDepartment.map((d: any) => ({ name: d.department || t('reports.unassigned'), value: d._count }))}>
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
