'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';

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

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  const loadAsset = () => {
    api.get(`/api/assets/${id}`).then(res => setAsset(res.data)).catch(() => router.push('/assets'));
  };

  useEffect(() => {
    loadAsset();
  }, [id]);

  useEffect(() => {
    if (editOpen && asset) {
      setEditForm({
        assignedTo: asset.assignedTo || '',
        department: asset.department || '',
        location: asset.location || '',
        status: asset.status || 'in_stock',
        warrantyEnd: asset.warrantyEnd ? new Date(asset.warrantyEnd).toISOString().slice(0, 10) : '',
        notes: asset.notes || '',
      });
    }
  }, [editOpen]);

  const handleEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/api/assets/${id}`, editForm);
      setEditOpen(false);
      loadAsset();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await api.delete(`/api/assets/${id}`);
    router.push('/assets');
  };

  if (!asset) return <div className="flex items-center justify-center h-64">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/assets')}><ArrowLeft className="h-4 w-4 mr-2" />{t('common.back')}</Button>
        <h1 className="text-2xl font-bold">{t('assets.detail')}</h1>
        <Badge>{t('assetStatus.' + asset.status)}</Badge>
        <div className="ml-auto flex gap-2">
          {hasPermission('asset:write') && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1" />{t('common.edit')}</Button>}
          {hasPermission('asset:delete') && <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4 mr-1" />{t('common.delete')}</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('assets.info')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.assignedTo')}</span><span>{asset.assignedTo || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.department')}</span><span>{asset.department || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.location')}</span><span>{asset.location || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.purchaseDate')}</span><span>{asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString(locale) : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('assets.purchasePrice')}</span><span>{asset.purchasePrice ? `¥${asset.purchasePrice}` : '-'}</span></div>
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('common.edit')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.assignedTo')}</label>
              <Input value={editForm.assignedTo || ''} onChange={e => setEditForm({ ...editForm, assignedTo: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.department')}</label>
              <Input value={editForm.department || ''} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.location')}</label>
              <Input value={editForm.location || ''} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.status')}</label>
              <select
                value={editForm.status || 'in_stock'}
                onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
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
              <textarea
                value={editForm.notes || ''}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
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
          <DialogHeader>
            <DialogTitle>{t('common.delete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('assets.deleteConfirm')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
