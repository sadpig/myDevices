'use client';
import { useEffect, useState, useRef } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ASSET_STATUS_VARIANT } from '@/lib/constants';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Upload } from 'lucide-react';

export default function AssetsPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebounce(search);
  const { sortBy, sortOrder, handleSort } = useSort('createdAt');

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [batchAssignTo, setBatchAssignTo] = useState('');
  const [batchDepartment, setBatchDepartment] = useState('');
  const [batchStatus, setBatchStatus] = useState('in_use');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');
  const [importRecords, setImportRecords] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{ created?: number; errors?: any[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Users & departments for assign dialog
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const loadAssets = () => {
    const params = new URLSearchParams({ page: String(page), limit: '20', sortBy, sortOrder });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    api.get(`/api/assets?${params}`).then(res => {
      setAssets(res.data.assets || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  };

  useEffect(() => { loadAssets(); }, [page, debouncedSearch, status, sortBy, sortOrder]);

  useEffect(() => {
    if (assignOpen) {
      api.get('/api/auth/users?limit=200').then(res => setUsers(res.data.users || res.data || [])).catch(() => {});
      api.get('/api/departments').then(res => setDepartments(res.data || [])).catch(() => {});
      setBatchAssignTo('');
      setBatchDepartment('');
      setBatchMsg('');
    }
  }, [assignOpen]);

  useEffect(() => {
    if (statusOpen) { setBatchStatus('in_use'); setBatchMsg(''); }
  }, [statusOpen]);

  useEffect(() => {
    if (importOpen) { setImportRecords([]); setImportResult(null); setBatchMsg(''); }
  }, [importOpen]);

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';
  const canWrite = hasPermission('asset:write');

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map(a => a.id)));
    }
  };

  const handleBatchAssign = async () => {
    setBatchLoading(true);
    setBatchMsg('');
    try {
      const payload: Record<string, unknown> = { assetIds: Array.from(selectedIds) };
      if (batchAssignTo) payload.assignedToId = batchAssignTo;
      if (batchDepartment) payload.departmentId = batchDepartment;
      const res = await api.post('/api/assets/batch-assign', payload);
      setBatchMsg(t('assets.batchSuccess', { count: res.data.updated }));
      setSelectedIds(new Set());
      loadAssets();
      setTimeout(() => setAssignOpen(false), 1000);
    } catch (err: any) {
      setBatchMsg(err?.response?.data?.error || t('common.operationFailed'));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchStatus = async () => {
    setBatchLoading(true);
    setBatchMsg('');
    try {
      const res = await api.post('/api/assets/batch-status', { assetIds: Array.from(selectedIds), status: batchStatus });
      setBatchMsg(t('assets.batchSuccess', { count: res.data.updated }));
      setSelectedIds(new Set());
      loadAssets();
      setTimeout(() => setStatusOpen(false), 1000);
    } catch (err: any) {
      setBatchMsg(err?.response?.data?.error || t('common.operationFailed'));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { setBatchMsg(t('assets.csvEmpty')); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const records = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const rec: Record<string, any> = {};
        headers.forEach((h, i) => { if (values[i]) rec[h] = values[i]; });
        if (rec.purchaseprice) rec.purchasePrice = parseFloat(rec.purchaseprice);
        if (rec.deviceid) rec.deviceId = rec.deviceid;
        return rec;
      }).filter(r => r.deviceId || r.deviceid);
      setImportRecords(records);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setBatchLoading(true);
    setBatchMsg('');
    try {
      const res = await api.post('/api/assets/import', { records: importRecords });
      setImportResult(res.data);
      loadAssets();
    } catch (err: any) {
      setBatchMsg(err?.response?.data?.error || t('common.operationFailed'));
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('assets.title')}</h1>
        {canWrite && <Link href="/assets/new"><Button>{t('assets.new')}</Button></Link>}
      </div>

      <div className="flex gap-4">
        <Input placeholder={t('assets.searchPlaceholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="border rounded-md px-3 py-2 text-sm bg-background text-foreground">
          <option value="">{t('common.allStatus')}</option>
          {(['in_use', 'in_stock', 'repairing', 'retired', 'lost'] as const).map(k => (
            <option key={k} value={k}>{t('assetStatus.' + k)}</option>
          ))}
        </select>
      </div>

      {/* Batch toolbar */}
      {canWrite && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border rounded-md">
          <span className="text-sm font-medium">{t('assets.selected', { count: selectedIds.size })}</span>
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>{t('assets.batchAssign')}</Button>
          <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)}>{t('assets.batchStatus')}</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>{t('common.clearSelection')}</Button>
        </div>
      )}

      {canWrite && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />{t('assets.csvImport')}
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {canWrite && (
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={assets.length > 0 && selectedIds.size === assets.length}
                      ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < assets.length; }}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </th>
                )}
                <th className="p-3 text-left">{t('assets.device')}</th>
                <th className="p-3 text-left">{t('assets.serial')}</th>
                <SortableHeader label={t('assets.assignedTo')} field="assignedTo" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('assets.department')} field="department" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('assets.status')} field="status" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('assets.warrantyEnd')} field="warrantyEnd" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label={t('assets.createdAt')} field="createdAt" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <th className="p-3 text-left">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a: any) => (
                <tr key={a.id} className={`border-b hover:bg-muted/20 ${selectedIds.has(a.id) ? 'bg-primary/5' : ''}`}>
                  {canWrite && (
                    <td className="p-3">
                      <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} className="h-4 w-4 cursor-pointer" />
                    </td>
                  )}
                  <td className="p-3 font-medium">{a.device?.deviceName || a.device?.modelName || '-'}</td>
                  <td className="p-3 font-mono text-xs">{a.device?.serialNumber || '-'}</td>
                  <td className="p-3">{a.assignedUser?.name || '-'}</td>
                  <td className="p-3">{a.department?.name || '-'}</td>
                  <td className="p-3"><Badge variant={ASSET_STATUS_VARIANT[a.status] || 'secondary'}>{t('assetStatus.' + a.status)}</Badge></td>
                  <td className="p-3">{a.warrantyEnd ? new Date(a.warrantyEnd).toLocaleDateString(locale) : '-'}</td>
                  <td className="p-3 text-xs">{new Date(a.createdAt).toLocaleDateString(locale)}</td>
                  <td className="p-3"><Link href={`/assets/${a.id}`}><Button variant="ghost" size="sm">{t('common.details')}</Button></Link></td>
                </tr>
              ))}
              {assets.length === 0 && <tr><td colSpan={canWrite ? 10 : 9} className="p-4 text-center text-muted-foreground">{t('assets.noAssets')}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{t('devices.pageInfo', { total, page, pages: Math.max(1, Math.ceil(total / 20)) })}</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>{t('common.prev')}</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>{t('common.next')}</Button>
        </div>
      </div>

      {/* Batch Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('assets.batchAssign')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('assets.selected', { count: selectedIds.size })}</p>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.assignedTo')}</label>
              <select value={batchAssignTo} onChange={e => setBatchAssignTo(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground">
                <option value="">{t('common.none')}</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.department')}</label>
              <select value={batchDepartment} onChange={e => setBatchDepartment(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground">
                <option value="">{t('common.none')}</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {batchMsg && <p className="text-sm text-muted-foreground">{batchMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleBatchAssign} disabled={batchLoading}>{batchLoading ? t('common.saving') : t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Status Dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('assets.batchStatus')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('assets.selected', { count: selectedIds.size })}</p>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('assets.status')}</label>
              <select value={batchStatus} onChange={e => setBatchStatus(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground">
                {(['in_use', 'in_stock', 'repairing', 'retired', 'lost'] as const).map(k => (
                  <option key={k} value={k}>{t('assetStatus.' + k)}</option>
                ))}
              </select>
            </div>
            {batchMsg && <p className="text-sm text-muted-foreground">{batchMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleBatchStatus} disabled={batchLoading}>{batchLoading ? t('common.saving') : t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('assets.csvImport')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('assets.csvHint')}</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvFile} className="text-sm" />
            {importRecords.length > 0 && (
              <p className="text-sm">{t('assets.csvParsed', { count: importRecords.length })}</p>
            )}
            {importResult && (
              <div className="text-sm space-y-1">
                <p className="text-green-600">{t('assets.csvCreated', { count: importResult.created })}</p>
                {(importResult.errors?.length ?? 0) > 0 && (
                  <p className="text-red-500">{t('assets.csvErrors', { count: importResult.errors?.length })}</p>
                )}
              </div>
            )}
            {batchMsg && <p className="text-sm text-muted-foreground">{batchMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleImport} disabled={batchLoading || importRecords.length === 0}>
              {batchLoading ? t('common.saving') : t('assets.importConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
