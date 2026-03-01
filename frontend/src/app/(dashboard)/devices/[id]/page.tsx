'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function DeviceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const [device, setDevice] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState({ deviceName: '', supervised: false });
  const [saving, setSaving] = useState(false);

  const statusLabels: Record<string, string> = {
    pending: t('status.pending'), enrolled: t('status.enrolled'), unenrolled: t('status.unenrolled'),
  };

  const cmdStatusLabels: Record<string, string> = {
    queued: t('commandStatus.queued'), sent: t('commandStatus.sent'), acknowledged: t('commandStatus.acknowledged'), error: t('commandStatus.error'), not_now: t('commandStatus.not_now'),
  };

  const assetStatusLabels: Record<string, string> = {
    in_use: t('assetStatus.in_use'), in_stock: t('assetStatus.in_stock'), repairing: t('assetStatus.repairing'), retired: t('assetStatus.retired'), lost: t('assetStatus.lost'),
  };

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  const loadDevice = () => {
    api.get(`/api/devices/${id}`).then(res => setDevice(res.data)).catch(() => router.push('/devices'));
  };

  useEffect(() => {
    loadDevice();
  }, [id]);

  useEffect(() => {
    if (editOpen && device) {
      setEditForm({ deviceName: device.deviceName || '', supervised: !!device.supervised });
    }
  }, [editOpen]);

  const handleEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/api/devices/${id}`, editForm);
      setEditOpen(false);
      loadDevice();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/devices/${id}`);
      router.push('/devices');
    } catch { }
  };

  if (!device) return <div className="flex items-center justify-center h-64">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/devices')}><ArrowLeft className="h-4 w-4 mr-2" />{t('common.back')}</Button>
        <h1 className="text-2xl font-bold">{device.deviceName || device.serialNumber}</h1>
        <Badge variant={device.enrollmentStatus === 'enrolled' ? 'default' : 'secondary'}>{statusLabels[device.enrollmentStatus]}</Badge>
        <div className="ml-auto flex gap-2">
          {hasPermission('device:write') && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-2" />{t('common.edit')}</Button>}
          {hasPermission('device:delete') && <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}</Button>}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">{t('devices.tabs.info')}</TabsTrigger>
          {hasPermission('mdm:command') && <TabsTrigger value="commands">{t('devices.tabs.commands')}</TabsTrigger>}
          <TabsTrigger value="profiles">{t('devices.tabs.profiles')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">{t('devices.sections.deviceInfo')}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.fields.type')}</span><span>{device.deviceType}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.fields.model')}</span><span>{device.modelName || device.model || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.fields.serialNumber')}</span><span className="font-mono">{device.serialNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">UDID</span><span className="font-mono text-xs">{device.udid}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.fields.osVersion')}</span><span>{device.osVersion || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.fields.storage')}</span><span>{device.storageCapacity ? `${Number(device.storageCapacity) / 1073741824} GB` : '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.supervised')}</span><span>{device.supervised ? t('common.yes') : t('common.no')}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">{t('devices.sections.networkInfo')}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">WiFi MAC</span><span className="font-mono">{device.wifiMac || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.fields.bluetoothMac')}</span><span className="font-mono">{device.bluetoothMac || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.fields.lastSeen')}</span><span>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString(locale) : '-'}</span></div>
              </CardContent>
            </Card>
          </div>
          {device.asset ? (
            <Card>
              <CardHeader><CardTitle className="text-sm">{t('devices.sections.linkedAsset')}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.fields.status')}</span><Badge>{assetStatusLabels[device.asset.status] || device.asset.status}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.fields.assignedTo')}</span><span>{device.asset.assignedTo || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.fields.department')}</span><span>{device.asset.department || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.fields.location')}</span><span>{device.asset.location || '-'}</span></div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {hasPermission('mdm:command') && (
        <TabsContent value="commands">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="p-3 text-left">{t('devices.commands.type')}</th>
                    <th className="p-3 text-left">{t('common.status')}</th>
                    <th className="p-3 text-left">{t('devices.commands.sentAt')}</th>
                    <th className="p-3 text-left">{t('devices.commands.acknowledgedAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(device.commands || []).map((cmd: any) => (
                    <tr key={cmd.id} className="border-b hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs">{cmd.commandType}</td>
                      <td className="p-3"><Badge variant="outline">{cmdStatusLabels[cmd.status] || cmd.status}</Badge></td>
                      <td className="p-3">{new Date(cmd.createdAt).toLocaleString(locale)}</td>
                      <td className="p-3">{cmd.acknowledgedAt ? new Date(cmd.acknowledgedAt).toLocaleString(locale) : '-'}</td>
                    </tr>
                  ))}
                  {(!device.commands || device.commands.length === 0) && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{t('devices.commands.empty')}</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        <TabsContent value="profiles">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="p-3 text-left">{t('profiles.fields.name')}</th>
                    <th className="p-3 text-left">{t('profiles.fields.identifier')}</th>
                    <th className="p-3 text-left">{t('devices.profiles.installedAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(device.profiles || []).map((dp: any) => (
                    <tr key={dp.id} className="border-b hover:bg-muted/20">
                      <td className="p-3">{dp.profile?.name || '-'}</td>
                      <td className="p-3 font-mono text-xs">{dp.profile?.identifier || '-'}</td>
                      <td className="p-3">{new Date(dp.installedAt).toLocaleString(locale)}</td>
                    </tr>
                  ))}
                  {(!device.profiles || device.profiles.length === 0) && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">{t('devices.profiles.empty')}</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('devices.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('devices.name')}</label>
              <Input
                value={editForm.deviceName}
                onChange={e => setEditForm(f => ({ ...f, deviceName: e.target.value }))}
                placeholder={t('devices.name')}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="supervised"
                checked={editForm.supervised}
                onChange={e => setEditForm(f => ({ ...f, supervised: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="supervised" className="text-sm font-medium">{t('devices.supervised')}</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('devices.deleteConfirm', { name: device.deviceName || device.serialNumber })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
