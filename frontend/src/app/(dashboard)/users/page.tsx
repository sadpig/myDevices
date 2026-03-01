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
  const { i18n } = useTranslation();
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
    setEDeptId(u.department?.id ?? '');
    setError('');
    setEditTarget(u);
  }

  async function handleCreate() {
    if (!cEmail || !cName || !cPassword || !cRoleId) { setError('请填写所有必填项'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/api/auth/register', {
        email: cEmail,
        name: cName,
        password: cPassword,
        roleId: cRoleId,
        ...(cDeptId ? { departmentId: cDeptId } : {}),
      });
      setCreateOpen(false);
      setPage(1);
      fetchUsers();
    } catch (e: any) {
      setError(e?.response?.data?.error || '创建失败');
    } finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editTarget || !eName || !eRoleId) { setError('请填写所有必填项'); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/api/auth/users/${editTarget.id}`, {
        name: eName,
        roleId: eRoleId,
        departmentId: eDeptId || null,
      });
      setEditTarget(null);
      fetchUsers();
    } catch (e: any) {
      setError(e?.response?.data?.error || '保存失败');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true); setError('');
    try {
      await api.delete(`/api/auth/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      if (users.length === 1 && page > 1) setPage(p => p - 1);
      else fetchUsers();
    } catch (e: any) {
      setError(e?.response?.data?.error || '删除失败');
    } finally { setSaving(false); }
  }

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">用户管理</h1>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />新建用户
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索姓名或邮箱"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 max-w-xs"
          />
        </div>
        <select
          value={filterDept}
          onChange={e => { setFilterDept(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="">全部部门</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={filterRole}
          onChange={e => { setFilterRole(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="">全部角色</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 text-left">姓名</th>
                <th className="p-3 text-left">邮箱</th>
                <th className="p-3 text-left">角色</th>
                <th className="p-3 text-left">部门</th>
                <th className="p-3 text-left">创建时间</th>
                <th className="p-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3">
                    <Badge variant="outline">{u.role.name}</Badge>
                  </td>
                  <td className="p-3">{u.department?.name ?? '-'}</td>
                  <td className="p-3 text-xs">
                    {new Date(u.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {canWrite && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { setError(''); setDeleteTarget(u); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">暂无用户</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">共 {total} 条，第 {page} 页</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * LIMIT >= total}>下一页</Button>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">邮箱 *</label>
              <Input value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="user@example.com" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">姓名 *</label>
              <Input value={cName} onChange={e => setCName(e.target.value)} placeholder="姓名" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">密码 *</label>
              <Input type="password" value={cPassword} onChange={e => setCPassword(e.target.value)} placeholder="密码" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">角色 *</label>
              <select value={cRoleId} onChange={e => setCRoleId(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">请选择角色</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">部门</label>
              <select value={cDeptId} onChange={e => setCDeptId(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">无</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? '创建中...' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">姓名 *</label>
              <Input value={eName} onChange={e => setEName(e.target.value)} placeholder="姓名" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">角色 *</label>
              <select value={eRoleId} onChange={e => setERoleId(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">请选择角色</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">部门</label>
              <select value={eDeptId} onChange={e => setEDeptId(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">无</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>取消</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除用户 <span className="font-medium text-foreground">{deleteTarget?.name}</span>（{deleteTarget?.email}）吗？此操作不可撤销。
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? '删除中...' : '删除'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
