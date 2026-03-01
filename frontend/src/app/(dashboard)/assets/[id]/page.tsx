'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Pencil, Trash2, Plus, Clock, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';

const flatDepts = (nodes: any[], depth = 0): { id: string; name: string; depth: number }[] =>
  nodes.flatMap((n: any) => [{ id: n.id, name: n.name, depth }, ...flatDepts(n.children || [], depth + 1)]);

export default function AssetDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [asset, setAsset] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [depts, setDepts] = useState<{ id: string; name: string; depth: number }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  // History & Maintenance
  const [history, setHistory] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintForm, setMaintForm] = useState({ reason: '', vendor: '', cost: '', startDate: '', endDate: '', notes: '' });
  const [maintSaving, setMaintSaving] = useState(false);

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';
  const canWrite = hasPermission('asset:write');

  const loadAsset = () => {
    api.get(`/api/assets/${id}`).then(res => setAsset(res.data)).catch(() => router.push('/assets'));
  };

  const loadHistory = () => {
    api.get(`/api/assets/${id}/history?page=${historyPage}&limit=20`).then(res => {
      setHistory(res.data.items || []);
      setHistoryTotal(res.data.total || 0);
    }).catch(() => {});
  };

  const loadMaintenance = () => {
    api.get(`/api/assets/${id}/maintenance`).then(res => setMaintenance(res.data || [])).catch(() => {});
  };

  useEffect(() => { loadAsset(); loadMaintenance(); }, [id]);
  useEffect(() => { loadHistory(); }, [id, historyPage]);

  useEffect(() => {
    if (editOpen) {
      api.get('/api/departments/tree').then(res => setDepts(flatDepts(res.data || []))).catch(() => {});
      if (asset) {
        setEditForm({
          assignedToId: asset.assignedToId || '',
          departmentId: asset.departmentId || '',
          location: asset.location || '',
          status: asset.status || 'in_stock',
          warrantyEnd: asset.warrantyEnd ? new Date(asset.warrantyEnd).toISOString().slice(0, 10) : '',
          notes: asset.notes || '',
        });
      }
    }
  }, [editOpen]);

  useEffect(() => {
    if (!editOpen) return;
    const params = new URLSearchParams();
    if (editForm.departmentId) params.set('departmentId', editForm.departmentId);
    api.get(`/api/auth/users?${params}`).then(res => setUsers(res.data.users || [])).catch(() => {});
  }, [editForm.departmentId, editOpen]);

  useEffect(() => {
    if (maintOpen) setMaintForm({ reason: '', vendor: '', cost: '', startDate: '', endDate: '', notes: '' });
  }, [maintOpen]);

  const handleEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/api/assets/${id}`, {
        ...editForm,
        assignedToId: editForm.assignedToId || undefined,
        departmentId: editForm.departmentId || undefined,
      });
      setEditOpen(false);
      loadAsset();
      loadHistory();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    await api.delete(`/api/assets/${id}`);
    router.push('/assets');
  };

  const handleAddMaintenance = async () => {
    if (!maintForm.reason || !maintForm.startDate) return;
    setMaintSaving(true);
    try {
      await api.post(`/api/assets/${id}/maintenance`, {
        reason: maintForm.reason,
        vendor: maintForm.vendor || undefined,
        cost: maintForm.cost ? parseFloat(maintForm.cost) : undefined,
        startDate: maintForm.startDate,
        endDate: maintForm.endDate || undefined,
        notes: maintForm.notes || undefined,
      });
      setMaintOpen(false);
      loadMaintenance();
    } finally { setMaintSaving(false); }
  };

  const handleDeleteMaintenance = async (mid: string) => {
    try {
      await api.delete(`/api/assets/${id}/maintenance/${mid}`);
      loadMaintenance();
    } catch {}
  };

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      created: t('assets.historyCreated'),
      assigned: t('assets.historyAssigned'),
      status_changed: t('assets.historyStatusChanged'),
    };
    return map[action] || action;
  };

  if (!asset) return <div className="flex items-center justify-center h-64">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/assets')}><ArrowLeft className="h-4 w-4 mr-2" />{t('common.back')}</Button>
        <h1 className="text-2xl font-bold">{t('assets.detail')}</h1>
        <Badge>{t('assetStatus.' + asset.status)}</Badge>
        <div className="ml-auto flex gap-2">
          {canWrite && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1" />{t('common.edit')}</Button>}
          {hasPermission('asset:delete') && <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4 mr-1" />{t('common.delete')}</Button>}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">{t('assets.info')}</TabsTrigger>
          <TabsTrigger value="history"><Clock className="h-4 w-4 mr-1" />{t('assets.history')}</TabsTrigger>
          <TabsTrigger value="maintenance"><Wrench className="h-4 w-4 mr-1" />{t('assets.maintenance')}</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">{t('assets.info')}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.assignedTo')}</span><span>{asset.assignedUser?.name || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.department')}</span><span>{asset.department?.name || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.location')}</span><span>{asset.location || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.purchaseDate')}</span><span>{asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString(locale) : '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.purchasePrice')}</span><span>{asset.purchasePrice ? new Intl.NumberFormat(locale, { style: 'currency', currency: i18n.language === 'zh' ? 'CNY' : 'USD' }).format(asset.purchasePrice) : '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.warrantyEnd')}</span><span>{asset.warrantyEnd ? new Date(asset.warrantyEnd).toLocaleDateString(locale) : '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.notes')}</span><span>{asset.notes || '-'}</span></div>
              </CardContent>
            </Card>

            {asset.device && (
              <Card>
                <CardHeader><CardTitle className="text-sm">{t('devices.sections.linkedAsset')}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.name')}</span><span>{asset.device.deviceName || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.type')}</span><span>{asset.device.deviceType}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.serial')}</span><span className="font-mono">{asset.device.serialNumber}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.osVersion')}</span><span>{asset.device.osVersion || '-'}</span></div>
                  <Link href={`/devices/${asset.device.id}`}><Button variant="outline" size="sm" className="mt-2 w-full">{t('common.details')}</Button></Link>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{t('assets.noHistory')}</p>
              ) : (
                <div className="divide-y">
                  {history.map((h: any) => (
                    <div key={h.id} className="p-4 flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{actionLabel(h.action)}</p>
                        {h.fromStatus && h.toStatus && (
                          <p className="text-xs text-muted-foreground">
                            {t('assetStatus.' + h.fromStatus)} → {t('assetStatus.' + h.toStatus)}
                          </p>
                        )}
                        {h.fromUserId && <p className="text-xs text-muted-foreground">{t('assets.historyFromUser')}: {h.fromUserId}</p>}
                        {h.toUserId && <p className="text-xs text-muted-foreground">{t('assets.historyToUser')}: {h.toUserId}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString(locale)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {historyTotal > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}>{t('common.prev')}</Button>
              <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => p + 1)} disabled={historyPage * 20 >= historyTotal}>{t('common.next')}</Button>
            </div>
          )}
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance">
          {canWrite && (
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => setMaintOpen(true)}><Plus className="h-4 w-4 mr-1" />{t('assets.addMaintenance')}</Button>
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="p-3 text-left">{t('assets.maintReason')}</th>
                    <th className="p-3 text-left">{t('assets.maintVendor')}</th>
                    <th className="p-3 text-left">{t('assets.maintCost')}</th>
                    <th className="p-3 text-left">{t('assets.maintStartDate')}</th>
                    <th className="p-3 text-left">{t('assets.maintEndDate')}</th>
                    <th className="p-3 text-left">{t('assets.notes')}</th>
                    {canWrite && <th className="p-3 text-left">{t('common.actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {maintenance.map((m: any) => (
                    <tr key={m.id} className="border-b hover:bg-muted/20">
                      <td className="p-3 font-medium">{m.reason}</td>
                      <td className="p-3">{m.vendor || '-'}</td>
                      <td className="p-3">{m.cost ? new Intl.NumberFormat(locale, { style: 'currency', currency: i18n.language === 'zh' ? 'CNY' : 'USD' }).format(m.cost) : '-'}</td>
                      <td className="p-3">{new Date(m.startDate).toLocaleDateString(locale)}</td>
                      <td className="p-3">{m.endDate ? new Date(m.endDate).toLocaleDateString(locale) : '-'}</td>
                      <td className="p-3 text-xs">{m.notes || '-'}</td>
                      {canWrite && (
                        <td className="p-3">
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteMaintenance(m.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {maintenance.length === 0 && (
                    <tr><td colSpan={canWrite ? 7 : 6} className="p-4 text-center text-muted-foreground">{t('assets.noMaintenance')}</td></tr>
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
          <DialogHeader><DialogTitle>{t('common.edit')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.department')}</label>
              <select value={editForm.departmentId || ''} onChange={e => setEditForm({ ...editForm, departmentId: e.target.value, assignedToId: '' })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">{t('common.select')}</option>
                {depts.map(d => <option key={d.id} value={d.id}>{'\u00a0'.repeat(d.depth * 2)}{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.assignedTo')}</label>
              <select value={editForm.assignedToId || ''} onChange={e => setEditForm({ ...editForm, assignedToId: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">{t('common.select')}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.location')}</label>
              <Input value={editForm.location || ''} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.status')}</label>
              <select value={editForm.status || 'in_stock'} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="in_use">{t('assetStatus.in_use')}</option>
                <option value="in_stock">{t('assetStatus.in_stock')}</option>
                <option value="repairing">{t('assetStatus.repairing')}</option>
                <option value="retired">{t('assetStatus.retired')}</option>
                <option value="lost">{t('assetStatus.lost')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.warrantyEnd')}</label>
              <Input type="date" value={editForm.warrantyEnd || ''} onChange={e => setEditForm({ ...editForm, warrantyEnd: e.target.value })} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">{t('assets.notes')}</label>
              <textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('common.delete')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('assets.deleteConfirm')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Maintenance Dialog */}
      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('assets.addMaintenance')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">{t('assets.maintReason')} *</label>
              <Input value={maintForm.reason} onChange={e => setMaintForm({ ...maintForm, reason: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.maintVendor')}</label>
              <Input value={maintForm.vendor} onChange={e => setMaintForm({ ...maintForm, vendor: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.maintCost')}</label>
              <Input type="number" value={maintForm.cost} onChange={e => setMaintForm({ ...maintForm, cost: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.maintStartDate')} *</label>
              <Input type="date" value={maintForm.startDate} onChange={e => setMaintForm({ ...maintForm, startDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.maintEndDate')}</label>
              <Input type="date" value={maintForm.endDate} onChange={e => setMaintForm({ ...maintForm, endDate: e.target.value })} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">{t('assets.notes')}</label>
              <textarea value={maintForm.notes} onChange={e => setMaintForm({ ...maintForm, notes: e.target.value })} rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddMaintenance} disabled={maintSaving}>{maintSaving ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
