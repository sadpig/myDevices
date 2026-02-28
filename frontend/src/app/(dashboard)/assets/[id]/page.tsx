'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const statusLabels: Record<string, string> = {
  in_use: '使用中', in_stock: '库存', repairing: '维修中', retired: '已退役', lost: '丢失',
};

export default function AssetDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [asset, setAsset] = useState<any>(null);

  useEffect(() => {
    api.get(`/api/assets/${id}`).then(res => setAsset(res.data)).catch(() => router.push('/assets'));
  }, [id, router]);

  if (!asset) return <div className="flex items-center justify-center h-64">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/assets')}><ArrowLeft className="h-4 w-4 mr-2" />返回</Button>
        <h1 className="text-2xl font-bold">资产详情</h1>
        <Badge>{statusLabels[asset.status] || asset.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">资产信息</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">分配人</span><span>{asset.assignedTo || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">部门</span><span>{asset.department || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">位置</span><span>{asset.location || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">采购日期</span><span>{asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('zh-CN') : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">采购价格</span><span>{asset.purchasePrice ? `¥${asset.purchasePrice}` : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">保修截止</span><span>{asset.warrantyEnd ? new Date(asset.warrantyEnd).toLocaleDateString('zh-CN') : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">备注</span><span>{asset.notes || '-'}</span></div>
          </CardContent>
        </Card>

        {asset.device && (
          <Card>
            <CardHeader><CardTitle className="text-sm">关联设备</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">设备名称</span><span>{asset.device.deviceName || '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">类型</span><span>{asset.device.deviceType}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">序列号</span><span className="font-mono">{asset.device.serialNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">系统版本</span><span>{asset.device.osVersion || '-'}</span></div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
