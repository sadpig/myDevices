'use client';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

interface Role { id: string; code: string; name: string; }
interface Department { id: string; name: string; }
interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: Department | null;
  createdAt: string;
}

const LIMIT = 20;

export default function UsersPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const [cEmail, setCEmail] = useState('');
  const [cName, setCName] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cRoleId, setCRoleId] = useState('');
  const [cDeptId, setCDeptId] = useState('');

  const [eName, setEName] = useState('');
  const [eRoleId, setERoleId] = useState('');
  const [eDeptId, setEDeptId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canWrite = hasPermission('user:write');
  const canDelete = hasPermission('user:delete');
  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  const fetchUsers = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) params.set('search', search);
    if (filterDept) params.set('departmentId', filterDept);
    if (filterRole) params.set('roleId', filterRole);
    api.get(`/api/auth/users?${params}`).then(res => {
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  }, [page, search, filterDept, filterRole]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    api.get('/api/roles').then(res => setRoles(res.data || [])).catch(() => {});
    api.get('/api/departments').then(res => setDepartments(res.data || [])).catch(() => {});
  }, []);

  function openCreate() {
    setCEmail(''); setCName(''); setCPassword(''); setCRoleId(''); setCDeptId('');
    setError('');
    setCreateOpen(true);
  }

  function openEdit(u: UserRow) {
    setEName(u.name);
    setERoleId(u.role.id);
    setEDeptId(u.department?.id || '');
    setError('');
    setEditTarget(u);
  }

  async function handleCreate() {
    if (!cEmail || !cName || !cPassword || !cRoleId) { setError(t('users.fillRequired')); return; }
    setSaving(true); setError('');
    try {
      await api.post('/api/auth/register', {
        email: cEmail, name: cName, password: cPassword,
        roleId: cRoleId, departmentId: cDeptId || undefined,
      });
      setCreateOpen(false);
      fetchUsers();
    } catch (e: any) {
      setError(e?.response?.data?.error || t('settings.createFailed'));
    } finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editTarget || !eName || !eRoleId) { setError(t('users.fillRequired')); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/api/auth/users/${editTarget.id}`, {
        name: eName, roleId: eRoleId, departmentId: eDeptId || null,
      });
      setEditTarget(null);
      fetchUsers();
    } catch (e: any) {
      setError(e?.response?.data?.error || t('settings.saveFailed'));
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true); setError('');
    try {
      await api.delete(`/api/auth/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (e: any) {
      setError(e?.response?.data?.error || t('roles.deleteFailed'));
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('users.title')}</h1>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />{t('users.create')}
          </Button>
        )}
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('users.searchPlaceholder')}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1); }} className="border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">{t('users.allDepartments')}</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }} className="border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">{t('users.allRoles')}</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 text-left">{t('users.name')}</th>
                <th className="p-3 text-left">{t('users.email')}</th>
                <th className="p-3 text-left">{t('users.role')}</th>
                <th className="p-3 text-left">{t('users.department')}</th>
                <th className="p-3 text-left">{t('users.createdAt')}</th>
                <th className="p-3 text-left">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3"><Badge variant="outline">{u.role.name}</Badge></td>
                  <td className="p-3">{u.department?.name || '-'}</td>
                  <td className="p-3">{new Date(u.createdAt).toLocaleDateString(locale)}</td>
                  <td className="p-3 space-x-1">
                    {canWrite && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setError(''); setDeleteTarget(u); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">{t('users.noUsers')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{t('common.total', { count: total })} · {t('common.page', { current: page, total: Math.max(1, Math.ceil(total / LIMIT)) })}</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>{t('common.prev')}</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * LIMIT >= total}>{t('common.next')}</Button>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={open => { if (!open) setCreateOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.create')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t('users.email')} *</label>
              <Input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t('users.name')} *</label>
              <Input value={cName} onChange={e => setCName(e.target.value)} placeholder={t('users.name')} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t('users.password')} *</label>
              <Input type="password" value={cPassword} onChange={e => setCPassword(e.target.value)} placeholder={t('users.password')} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t('users.role')} *</label>
              <select value={cRoleId} onChange={e => setCRoleId(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">{t('users.selectRole')}</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('users.department')}</label>
              <select value={cDeptId} onChange={e => setCDeptId(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">{t('users.noDepartment')}</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? t('common.creating') : t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.editUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t('users.name')} *</label>
              <Input value={eName} onChange={e => setEName(e.target.value)} placeholder={t('users.name')} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t('users.role')} *</label>
              <select value={eRoleId} onChange={e => setERoleId(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">{t('users.selectRole')}</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('users.department')}</label>
              <select value={eDeptId} onChange={e => setEDeptId(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">{t('users.noDepartment')}</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('users.deleteConfirm', { name: deleteTarget?.name, email: deleteTarget?.email })}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? t('roles.deleting') : t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
