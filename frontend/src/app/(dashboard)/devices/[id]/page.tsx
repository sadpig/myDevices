'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';

const statusLabels: Record<string, string> = {
  pending: '待注册', enrolled: '已注册', unenrolled: '已注销',
};

const cmdStatusLabels: Record<string, string> = {
  queued: '排队中', sent: '已发送', acknowledged: '已确认', error: '错误', not_now: '稍后',
};

export default function DeviceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [device, setDevice] = useState<any>(null);

  useEffect(() => {
    api.get(`/api/devices/${id}`).then(res => setDevice(res.data)).catch(() => router.push('/devices'));
  }, [id, router]);

  if (!device) return <div className="flex items-center justify-center h-64">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/devices')}><ArrowLeft className="h-4 w-4 mr-2" />返回</Button>
        <h1 className="text-2xl font-bold">{device.deviceName || device.serialNumber}</h1>
        <Badge variant={device.enrollmentStatus === 'enrolled' ? 'default' : 'secondary'}>{statusLabels[device.enrollmentStatus]}</Badge>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="commands">命令历史</TabsTrigger>
          <TabsTrigger value="profiles">配置描述文件</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">设备信息</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">类型</span><span>{device.deviceType}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">型号</span><span>{device.modelName || device.model || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">序列号</span><span className="font-mono">{device.serialNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">UDID</span><span className="font-mono text-xs">{device.udid}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">系统版本</span><span>{device.osVersion || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">存储容量</span><span>{device.storageCapacity ? `${Number(device.storageCapacity) / 1073741824} GB` : '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">受监管</span><span>{device.supervised ? '是' : '否'}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">网络信息</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">WiFi MAC</span><span className="font-mono">{device.wifiMac || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">蓝牙 MAC</span><span className="font-mono">{device.bluetoothMac || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">最后在线</span><span>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('zh-CN') : '-'}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="commands">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">命令类型</th>
                    <th className="p-3 text-left">状态</th>
                    <th className="p-3 text-left">入队时间</th>
                    <th className="p-3 text-left">确认时间</th>
                  </tr>
                </thead>
                <tbody>
                  {(device.commands || []).map((cmd: any) => (
                    <tr key={cmd.id} className="border-b">
                      <td className="p-3 font-mono text-xs">{cmd.commandType}</td>
                      <td className="p-3"><Badge variant={cmd.status === 'acknowledged' ? 'default' : 'secondary'}>{cmdStatusLabels[cmd.status] || cmd.status}</Badge></td>
                      <td className="p-3">{new Date(cmd.queuedAt).toLocaleString('zh-CN')}</td>
                      <td className="p-3">{cmd.acknowledgedAt ? new Date(cmd.acknowledgedAt).toLocaleString('zh-CN') : '-'}</td>
                    </tr>
                  ))}
                  {(!device.commands || device.commands.length === 0) && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">暂无命令记录</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">名称</th>
                    <th className="p-3 text-left">标识符</th>
                    <th className="p-3 text-left">安装时间</th>
                  </tr>
                </thead>
                <tbody>
                  {(device.profiles || []).map((dp: any) => (
                    <tr key={dp.id} className="border-b">
                      <td className="p-3">{dp.profile?.name || '-'}</td>
                      <td className="p-3 font-mono text-xs">{dp.profile?.identifier || '-'}</td>
                      <td className="p-3">{new Date(dp.installedAt).toLocaleString('zh-CN')}</td>
                    </tr>
                  ))}
                  {(!device.profiles || device.profiles.length === 0) && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">暂无配置描述文件</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
