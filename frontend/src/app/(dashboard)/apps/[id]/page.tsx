'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';

export default function AppDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canDeploy = hasPermission('app:deploy');
  const canWrite = hasPermission('app:write');

  const [app, setApp] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', version: '', category: '' });
  const [saving, setSaving] = useState(false);

  // Install dialog state
  const [installOpen, setInstallOpen] = useState(false);
  const [installMode, setInstallMode] = useState<'device' | 'department'>('device');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [installMsg, setInstallMsg] = useState('');

  const loadApp = () => {
    api.get(`/api/apps/${id}`).then(res => {
      setApp(res.data);
      setForm({ name: res.data.name, version: res.data.version || '', category: res.data.category || '' });
    }).catch(() => router.push('/apps'));
  };

  useEffect(() => { loadApp(); }, [id]);

  useEffect(() => {
    if (installOpen) {
      api.get('/api/departments').then(res => setDepartments(res.data || [])).catch(() => {});
      setSelectedDeviceIds([]);
      setSelectedDept('');
      setInstallMsg('');
    }
  }, [installOpen]);

  useEffect(() => {
    if (deviceSearch.length >= 2) {
      api.get(`/api/devices/search?q=${encodeURIComponent(deviceSearch)}`).then(res => setSearchResults(res.data.devices || [])).catch(() => {});
    } else {
      setSearchResults([]);
    }
  }, [deviceSearch]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/apps/${id}`, form);
      setEditing(false);
      loadApp();
    } catch {}
    setSaving(false);
  };

  const handleInstall = async () => {
    setInstallMsg('');
    try {
      const payload: any = {};
      if (installMode === 'device' && selectedDeviceIds.length > 0) {
        payload.deviceIds = selectedDeviceIds;
      } else if (installMode === 'department' && selectedDept) {
        payload.departmentId = selectedDept;
      } else {
        return;
      }
      const res = await api.post(`/api/apps/${id}/install`, payload);
      setInstallMsg(t('apps.installSuccess', { count: res.data.installed, defaultValue: `Installed to ${res.data.installed} target(s)` }));
      loadApp();
      setTimeout(() => setInstallOpen(false), 1200);
    } catch (err: any) {
      setInstallMsg(err?.response?.data?.error || t('common.operationFailed'));
    }
  };

  if (!app) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{app.name}</h1>
        <div className="flex gap-2">
          {canDeploy && <Button onClick={() => setInstallOpen(true)}>{t('apps.install')}</Button>}
          <Button variant="outline" onClick={() => router.push('/apps')}>{t('common.back', 'Back')}</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('apps.detail')}</CardTitle>
            {canWrite && !editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>{t('common.edit')}</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('apps.name')}</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('apps.version')}</label>
                  <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('apps.category')}</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground">
                    <option value="">-</option>
                    {['productivity', 'utility', 'education', 'business', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">{t('apps.bundleId')}:</span> <span className="font-mono">{app.bundleId}</span></div>
              <div><span className="text-muted-foreground">{t('apps.version')}:</span> {app.version || '-'}</div>
              <div><span className="text-muted-foreground">{t('apps.category')}:</span> {app.category || '-'}</div>
              <div><span className="text-muted-foreground">{t('apps.source')}:</span> {app.source || '-'}</div>
              <div><span className="text-muted-foreground">{t('apps.managedApp')}:</span> <Badge variant={app.managedApp ? 'default' : 'secondary'}>{app.managedApp ? 'Yes' : 'No'}</Badge></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Installed devices / assignments */}
      <Card>
        <CardHeader><CardTitle>{t('apps.installedDevices')}</CardTitle></CardHeader>
        <CardContent>
          {app.assignments?.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="p-2 text-left">{t('dashboard.deviceName', 'Device')}</th>
                  <th className="p-2 text-left">{t('assets.serial', 'Serial')}</th>
                  <th className="p-2 text-left">{t('assets.department')}</th>
                  <th className="p-2 text-left">{t('assets.status')}</th>
                </tr>
              </thead>
              <tbody>
                {app.assignments.map((a: any) => (
                  <tr key={a.id} className="border-b hover:bg-muted/20">
                    <td className="p-2">{a.device?.deviceName || '-'}</td>
                    <td className="p-2 font-mono text-xs">{a.device?.serialNumber || '-'}</td>
                    <td className="p-2">{a.department?.name || '-'}</td>
                    <td className="p-2"><Badge variant={a.status === 'pending' ? 'secondary' : a.status === 'removed' ? 'destructive' : 'default'}>{a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-muted-foreground py-4">{t('apps.noInstalls', 'No installations yet')}</p>
          )}
        </CardContent>
      </Card>

      {/* Install Dialog */}
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('apps.install')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-4">
              <Button variant={installMode === 'device' ? 'default' : 'outline'} size="sm" onClick={() => setInstallMode('device')}>{t('apps.installToDevices')}</Button>
              <Button variant={installMode === 'department' ? 'default' : 'outline'} size="sm" onClick={() => setInstallMode('department')}>{t('apps.installToDepartment')}</Button>
            </div>
            {installMode === 'device' ? (
              <div className="space-y-2">
                <Input placeholder={t('apps.selectDevices')} value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)} />
                {searchResults.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-auto">
                    {searchResults.map((d: any) => (
                      <label key={d.id} className="flex items-center gap-2 p-2 hover:bg-muted/20 cursor-pointer">
                        <input type="checkbox" checked={selectedDeviceIds.includes(d.id)} onChange={() => {
                          setSelectedDeviceIds(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id]);
                        }} className="h-4 w-4" />
                        <span className="text-sm">{d.deviceName || d.modelName} <span className="text-muted-foreground font-mono text-xs">({d.serialNumber})</span></span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedDeviceIds.length > 0 && (
                  <p className="text-sm text-muted-foreground">{t('common.selected', { count: selectedDeviceIds.length, defaultValue: `${selectedDeviceIds.length} selected` })}</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('apps.selectDepartment')}</label>
                <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground">
                  <option value="">-</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            {installMsg && <p className="text-sm text-muted-foreground">{installMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleInstall}>{t('apps.install')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
