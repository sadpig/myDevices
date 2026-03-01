'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const assetStatusLabels: Record<string, string> = {
  in_use: '使用中', in_stock: '库存', repairing: '维修中', retired: '已退役', lost: '丢失',
};

export default function ReportsPage() {
  const [deviceStats, setDeviceStats] = useState<any>(null);
  const [assetStats, setAssetStats] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);

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
      alert('导出失败');
    }
  };

  useEffect(() => {
    api.get('/api/reports/devices').then(res => setDeviceStats(res.data)).catch(() => {});
    api.get('/api/reports/assets').then(res => setAssetStats(res.data)).catch(() => {});
    api.get('/api/reports/compliance').then(res => setCompliance(res.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">报表中心</h1>

      {compliance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">MDM 注册率</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-green-600">{compliance.enrollmentRate}%</div><p className="text-xs text-muted-foreground">{compliance.enrolled} / {compliance.totalDevices}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">监管率</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-blue-600">{compliance.supervisionRate}%</div><p className="text-xs text-muted-foreground">{compliance.supervised} / {compliance.totalDevices}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">资产覆盖率</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-purple-600">{compliance.assetCoverage}%</div><p className="text-xs text-muted-foreground">{compliance.withAsset} / {compliance.totalDevices}</p></CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices">设备报表</TabsTrigger>
          <TabsTrigger value="assets">资产报表</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>设备统计</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCsv('devices')}>导出 CSV</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>设备类型分布</CardTitle></CardHeader>
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
              <CardHeader><CardTitle>系统版本分布 (Top 10)</CardTitle></CardHeader>
              <CardContent className="h-64">
                {deviceStats?.byOS && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deviceStats.byOS.map((d: any) => ({ name: d.osVersion || '未知', value: d._count }))}>
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
            <CardTitle>资产统计</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCsv('assets')}>导出 CSV</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>资产状态分布</CardTitle></CardHeader>
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
              <CardHeader><CardTitle>部门分布 (Top 10)</CardTitle></CardHeader>
              <CardContent className="h-64">
                {assetStats?.byDepartment && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assetStats.byDepartment.map((d: any) => ({ name: d.department || '未分配', value: d._count }))}>
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
