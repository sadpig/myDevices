'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NewAssetPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    deviceId: '', purchaseDate: '', purchasePrice: '', warrantyEnd: '',
    assignedTo: '', department: '', location: '', status: 'in_stock', notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = {
        ...form,
        purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : undefined,
      };
      await api.post('/api/assets', data);
      router.push('/assets');
    } catch {
      setError('创建失败，请检查输入');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/assets')}><ArrowLeft className="h-4 w-4 mr-2" />返回</Button>
        <h1 className="text-2xl font-bold">新建资产</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader><CardTitle>资产信息</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}
            <div className="space-y-2">
              <label className="text-sm font-medium">设备 ID</label>
              <Input value={form.deviceId} onChange={e => update('deviceId', e.target.value)} placeholder="设备 UUID" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">采购日期</label>
                <Input type="date" value={form.purchaseDate} onChange={e => update('purchaseDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">采购价格</label>
                <Input type="number" step="0.01" value={form.purchasePrice} onChange={e => update('purchasePrice', e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">保修截止</label>
              <Input type="date" value={form.warrantyEnd} onChange={e => update('warrantyEnd', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">分配人</label>
                <Input value={form.assignedTo} onChange={e => update('assignedTo', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">部门</label>
                <Input value={form.department} onChange={e => update('department', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">位置</label>
                <Input value={form.location} onChange={e => update('location', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">状态</label>
                <select value={form.status} onChange={e => update('status', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="in_stock">库存</option>
                  <option value="in_use">使用中</option>
                  <option value="repairing">维修中</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">备注</label>
              <Input value={form.notes} onChange={e => update('notes', e.target.value)} />
            </div>
            <Button type="submit" disabled={loading}>{loading ? '创建中...' : '创建资产'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
