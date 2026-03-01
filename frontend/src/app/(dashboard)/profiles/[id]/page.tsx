'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

const PAYLOAD_TYPES = ['WiFi', 'VPN', 'Email', 'Passcode', 'Restrictions', 'Certificate', 'APN', 'General'];

export default function ProfileDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', payloadType: 'WiFi', description: '', payload: '{}' });
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [installError, setInstallError] = useState('');
  const [installing, setInstalling] = useState(false);

  const loadProfile = () => {
    api.get(`/api/profiles/${id}`).then(res => setProfile(res.data)).catch(() => router.push('/profiles'));
  };

  useEffect(() => { loadProfile(); }, [id]);

  useEffect(() => {
    if (editOpen && profile) {
      setEditForm({
        name: profile.name || '',
        payloadType: profile.payloadType || 'WiFi',
        description: profile.description || '',
        payload: JSON.stringify(profile.payload ?? {}, null, 2),
      });
      setEditError('');
    }
  }, [editOpen]);

  useEffect(() => {
    if (installOpen) {
      setDeviceId('');
      setInstallError('');
    }
  }, [installOpen]);

  const handleEdit = async () => {
    setEditError('');
    let parsedPayload: object;
    try {
      parsedPayload = JSON.parse(editForm.payload);
    } catch {
      setEditError('Payload 不是有效的 JSON');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/profiles/${id}`, {
        name: editForm.name,
        payloadType: editForm.payloadType,
        description: editForm.description || undefined,
        payload: parsedPayload,
      });
      setEditOpen(false);
      loadProfile();
    } catch (err: any) {
      setEditError(err?.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/profiles/${id}`);
      router.push('/profiles');
    } catch {}
  };

  const handleInstall = async () => {
    setInstallError('');
    if (!deviceId.trim()) { setInstallError('请输入设备 ID'); return; }
    setInstalling(true);
    try {
      await api.post(`/api/profiles/${id}/install`, { deviceId: deviceId.trim() });
      setInstallOpen(false);
      loadProfile();
    } catch (err: any) {
      setInstallError(err?.response?.data?.error || '安装失败');
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async (dId: string) => {
    try {
      await api.delete(`/api/profiles/${id}/devices/${dId}`);
      loadProfile();
    } catch {}
  };

  if (!profile) return <div className="flex items-center justify-center h-64">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/profiles')}>
          <ArrowLeft className="h-4 w-4 mr-2" />返回
        </Button>
        <h1 className="text-2xl font-bold">{profile.name}</h1>
        <Badge variant="outline">{profile.payloadType}</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />编辑
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />删除
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="devices">已安装设备 ({profile.devices?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>配置详情</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">名称</p>
                  <p className="font-medium">{profile.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">标识符</p>
                  <p className="font-mono">{profile.identifier}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">负载类型</p>
                  <p>{profile.payloadType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">描述</p>
                  <p>{profile.description || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">创建时间</p>
                  <p>{new Date(profile.createdAt).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">更新时间</p>
                  <p>{new Date(profile.updatedAt).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Payload</p>
                <pre className="bg-gray-50 rounded p-4 overflow-auto text-xs font-mono">
                  {JSON.stringify(profile.payload ?? {}, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setInstallOpen(true)}>安装到设备</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">设备名称</th>
                    <th className="p-3 text-left">序列号</th>
                    <th className="p-3 text-left">设备类型</th>
                    <th className="p-3 text-left">安装时间</th>
                    <th className="p-3 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(profile.devices ?? []).map((entry: any) => (
                    <tr key={entry.deviceId} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{entry.device?.deviceName || '-'}</td>
                      <td className="p-3 font-mono text-xs">{entry.device?.serialNumber || '-'}</td>
                      <td className="p-3">{entry.device?.deviceType || '-'}</td>
                      <td className="p-3 text-xs">{entry.installedAt ? new Date(entry.installedAt).toLocaleString('zh-CN') : '-'}</td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleUninstall(entry.deviceId)}>
                          卸载
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(profile.devices ?? []).length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">暂未安装到任何设备</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>编辑配置描述文件</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">名称</label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="名称" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">负载类型</label>
              <select
                value={editForm.payloadType}
                onChange={e => setEditForm(f => ({ ...f, payloadType: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {PAYLOAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">描述</label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full border rounded-md px-3 py-2 text-sm resize-none"
                placeholder="可选描述"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Payload (JSON)</label>
              <textarea
                value={editForm.payload}
                onChange={e => setEditForm(f => ({ ...f, payload: e.target.value }))}
                rows={6}
                className="w-full border rounded-md px-3 py-2 text-sm font-mono resize-y"
              />
            </div>
            {editError && <p className="text-sm text-red-500">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            确定要删除配置描述文件 "{profile.name}" 吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install Dialog */}
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>安装到设备</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">设备 ID (UUID)</label>
              <Input
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            {installError && <p className="text-sm text-red-500">{installError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallOpen(false)}>取消</Button>
            <Button onClick={handleInstall} disabled={installing}>{installing ? '安装中...' : '确认安装'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
