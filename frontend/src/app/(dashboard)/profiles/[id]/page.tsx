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
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';

const PAYLOAD_TYPES = ['WiFi', 'VPN', 'Email', 'Passcode', 'Restrictions', 'Certificate', 'APN', 'General'];

export default function ProfileDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const router = useRouter();
  const { hasPermission } = useAuth();
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

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

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
      setEditError(t('profiles.invalidJson'));
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
      setEditError(err?.response?.data?.error || t('common.saveFailed'));
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
    if (!deviceId.trim()) { setInstallError(t('profiles.enterDeviceId')); return; }
    setInstalling(true);
    try {
      await api.post(`/api/profiles/${id}/install`, { deviceId: deviceId.trim() });
      setInstallOpen(false);
      loadProfile();
    } catch (err: any) {
      setInstallError(err?.response?.data?.error || t('profiles.installFailed'));
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

  if (!profile) return <div className="flex items-center justify-center h-64">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/profiles')}>
          <ArrowLeft className="h-4 w-4 mr-2" />{t('common.back')}
        </Button>
        <h1 className="text-2xl font-bold">{profile.name}</h1>
        <Badge variant="outline">{profile.payloadType}</Badge>
        <div className="ml-auto flex gap-2">
          {hasPermission('profile:write') && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />{t('common.edit')}
          </Button>}
          {hasPermission('profile:write') && <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}
          </Button>}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">{t('profiles.basicInfo')}</TabsTrigger>
          <TabsTrigger value="devices">{t('profiles.installedDevices', { count: profile.devices?.length ?? 0 })}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t('profiles.detail')}</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">{t('profiles.name')}</p>
                  <p className="font-medium">{profile.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('profiles.identifier')}</p>
                  <p className="font-mono">{profile.identifier}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('profiles.payloadType')}</p>
                  <p>{profile.payloadType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('profiles.description')}</p>
                  <p>{profile.description || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('profiles.createdAt')}</p>
                  <p>{new Date(profile.createdAt).toLocaleString(locale)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('profiles.updatedAt')}</p>
                  <p>{new Date(profile.updatedAt).toLocaleString(locale)}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Payload</p>
                <pre className="bg-muted/30 rounded p-4 overflow-auto text-xs font-mono">
                  {JSON.stringify(profile.payload ?? {}, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setInstallOpen(true)}>{t('profiles.installToDevice')}</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="p-3 text-left">{t('devices.deviceName')}</th>
                    <th className="p-3 text-left">{t('devices.serialNumber')}</th>
                    <th className="p-3 text-left">{t('devices.deviceType')}</th>
                    <th className="p-3 text-left">{t('profiles.installedAt')}</th>
                    <th className="p-3 text-left">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(profile.devices ?? []).map((entry: any) => (
                    <tr key={entry.deviceId} className="border-b hover:bg-muted/20">
                      <td className="p-3 font-medium">{entry.device?.deviceName || '-'}</td>
                      <td className="p-3 font-mono text-xs">{entry.device?.serialNumber || '-'}</td>
                      <td className="p-3">{entry.device?.deviceType || '-'}</td>
                      <td className="p-3 text-xs">{entry.installedAt ? new Date(entry.installedAt).toLocaleString(locale) : '-'}</td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleUninstall(entry.deviceId)}>
                          {t('profiles.uninstall')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(profile.devices ?? []).length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{t('profiles.noDevicesInstalled')}</td></tr>
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
          <DialogHeader><DialogTitle>{t('profiles.editProfile')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('profiles.name')}</label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder={t('profiles.name')} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('profiles.payloadType')}</label>
              <select
                value={editForm.payloadType}
                onChange={e => setEditForm(f => ({ ...f, payloadType: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              >
                {PAYLOAD_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('profiles.description')}</label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full border rounded-md px-3 py-2 text-sm resize-none"
                placeholder={t('profiles.descriptionOptional')}
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
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('profiles.deleteConfirm', { name: profile.name })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install Dialog */}
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('profiles.installToDevice')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('profiles.deviceIdLabel')}</label>
              <Input
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            {installError && <p className="text-sm text-red-500">{installError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleInstall} disabled={installing}>{installing ? t('profiles.installing') : t('profiles.confirmInstall')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
