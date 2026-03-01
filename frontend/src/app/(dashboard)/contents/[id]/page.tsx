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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function ContentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canDeploy = hasPermission('content:deploy');
  const canWrite = hasPermission('content:write');

  const [content, setContent] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', version: '' });
  const [saving, setSaving] = useState(false);

  // Distribute dialog state
  const [distOpen, setDistOpen] = useState(false);
  const [distMode, setDistMode] = useState<'device' | 'department'>('device');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [distMsg, setDistMsg] = useState('');

  const loadContent = () => {
    api.get(`/api/contents/${id}`).then(res => {
      setContent(res.data);
      setForm({ name: res.data.name, description: res.data.description || '', version: res.data.version || '' });
    }).catch(() => router.push('/contents'));
  };

  useEffect(() => { loadContent(); }, [id]);

  useEffect(() => {
    if (distOpen) {
      api.get('/api/departments').then(res => setDepartments(res.data || [])).catch(() => {});
      setSelectedDeviceIds([]);
      setSelectedDept('');
      setDistMsg('');
    }
  }, [distOpen]);

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
      await api.put(`/api/contents/${id}`, form);
      setEditing(false);
      loadContent();
    } catch {}
    setSaving(false);
  };

  const handleDistribute = async () => {
    setDistMsg('');
    try {
      const payload: any = {};
      if (distMode === 'device' && selectedDeviceIds.length > 0) {
        payload.deviceIds = selectedDeviceIds;
      } else if (distMode === 'department' && selectedDept) {
        payload.departmentId = selectedDept;
      } else {
        return;
      }
      const res = await api.post(`/api/contents/${id}/distribute`, payload);
      setDistMsg(t('contents.distributeSuccess', { count: res.data.distributed, defaultValue: `Distributed to ${res.data.distributed} target(s)` }));
      loadContent();
      setTimeout(() => setDistOpen(false), 1200);
    } catch (err: any) {
      setDistMsg(err?.response?.data?.error || t('common.operationFailed'));
    }
  };

  if (!content) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{content.name}</h1>
        <div className="flex gap-2">
          {canDeploy && <Button onClick={() => setDistOpen(true)}>{t('contents.distribute')}</Button>}
          <Button variant="outline" onClick={() => router.push('/contents')}>{t('common.back', 'Back')}</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('contents.detail')}</CardTitle>
            {canWrite && !editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>{t('common.edit')}</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('contents.name')}</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('contents.version')}</label>
                <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('contents.description')}</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] bg-background text-foreground"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">{t('contents.type')}:</span> <Badge>{String(t(`contents.types.${content.type}`, { defaultValue: content.type }))}</Badge></div>
              <div><span className="text-muted-foreground">{t('contents.version')}:</span> {content.version || '-'}</div>
              <div><span className="text-muted-foreground">{t('contents.fileSize')}:</span> {formatFileSize(content.fileSize)}</div>
              {content.fileUrl && (
                <div><span className="text-muted-foreground">{t('contents.uploadFile')}:</span> <a href={content.fileUrl} className="text-primary underline" target="_blank" rel="noreferrer">{t('common.download', 'Download')}</a></div>
              )}
              {content.description && (
                <div className="col-span-2"><span className="text-muted-foreground">{t('contents.description')}:</span> {content.description}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution assignments */}
      <Card>
        <CardHeader><CardTitle>{t('contents.distributions', 'Distributions')}</CardTitle></CardHeader>
        <CardContent>
          {content.assignments?.length > 0 ? (
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
                {content.assignments.map((a: any) => (
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
            <p className="text-center text-muted-foreground py-4">{t('contents.noDistributions', 'No distributions yet')}</p>
          )}
        </CardContent>
      </Card>

      {/* Distribute Dialog */}
      <Dialog open={distOpen} onOpenChange={setDistOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('contents.distribute')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-4">
              <Button variant={distMode === 'device' ? 'default' : 'outline'} size="sm" onClick={() => setDistMode('device')}>{t('apps.installToDevices')}</Button>
              <Button variant={distMode === 'department' ? 'default' : 'outline'} size="sm" onClick={() => setDistMode('department')}>{t('apps.installToDepartment')}</Button>
            </div>
            {distMode === 'device' ? (
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
            {distMsg && <p className="text-sm text-muted-foreground">{distMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDistOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleDistribute}>{t('contents.distribute')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
