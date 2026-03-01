'use client';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Trash2, Save, Plus, ChevronRight, ChevronDown, KeyRound, Users, Building2, Shield, Mail } from 'lucide-react';

// ─── Types ───
interface Dept { id: string; name: string; code: string; parentId?: string; sortOrder: number; _count?: { users: number }; children?: Dept[] }
interface Role { id: string; name: string; code: string; description?: string; dataScope: string; isSystem: boolean; permissions: Perm[]; _count?: { users: number } }
interface Perm { id: string; code: string; name: string; module: string }
interface UserItem { id: string; email: string; name: string; role: { id: string; name: string; code: string }; department?: { id: string; name: string }; createdAt: string }

export default function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />{t('settings.userManagement')}</TabsTrigger>
          <TabsTrigger value="departments"><Building2 className="h-4 w-4 mr-1" />{t('settings.departmentManagement')}</TabsTrigger>
          <TabsTrigger value="roles"><Shield className="h-4 w-4 mr-1" />{t('settings.roleManagement')}</TabsTrigger>
          <TabsTrigger value="apns">{t('settings.apnsCert')}</TabsTrigger>
          <TabsTrigger value="smtp"><Mail className="h-4 w-4 mr-1" />{t('settings.smtpConfig')}</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UserManagement /></TabsContent>
        <TabsContent value="departments"><DepartmentManagement /></TabsContent>
        <TabsContent value="roles"><RoleManagement /></TabsContent>
        <TabsContent value="apns"><ApnsSettings /></TabsContent>
        <TabsContent value="smtp"><SmtpSettings /></TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════
// User Management
// ═══════════════════════════════════════════
function UserManagement() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', roleId: '', departmentId: '' });
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', roleId: '', departmentId: '' });
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [resetPwdResult, setResetPwdResult] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get('/api/auth/users').then(r => setUsers(r.data.users || [])).catch(() => {});
    api.get('/api/roles').then(r => setRoles(r.data.roles || r.data || [])).catch(() => {});
    api.get('/api/departments/tree').then(r => setDepts(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const flatDepts = (nodes: Dept[], depth = 0): { id: string; name: string; depth: number }[] =>
    nodes.flatMap(n => [{ id: n.id, name: n.name, depth }, ...flatDepts(n.children || [], depth + 1)]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setMessage('');
    try {
      await api.post('/api/auth/register', newUser);
      setMessage(t('settings.userCreated'));
      setNewUser({ email: '', name: '', password: '', roleId: '', departmentId: '' });
      load();
    } catch { setMessage(t('settings.createFailed')); }
    finally { setCreating(false); }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    try {
      await api.put(`/api/auth/users/${editingUser.id}`, editForm);
      load(); setEditingUser(null);
    } catch { setMessage(t('settings.editFailed')); }
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    try { await api.delete(`/api/auth/users/${deleteUserId}`); load(); } catch { setMessage(t('settings.deleteFailed')); }
    setDeleteUserId(null);
  };

  const handleResetPwd = async (userId: string) => {
    try {
      const res = await api.post(`/api/auth/users/${userId}/reset-password`);
      setResetPwdResult(res.data.password);
    } catch { setMessage(t('settings.resetPasswordFailed')); }
  };

  const deleteTarget = users.find(u => u.id === deleteUserId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t('settings.createUser')}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <Input placeholder={t('settings.email')} type="email" required value={newUser.email} onChange={e => setNewUser(f => ({ ...f, email: e.target.value }))} />
            <Input placeholder={t('settings.name')} required value={newUser.name} onChange={e => setNewUser(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder={t('settings.password')} type="password" required minLength={6} value={newUser.password} onChange={e => setNewUser(f => ({ ...f, password: e.target.value }))} />
            <select className="border rounded-md px-3 py-2 text-sm bg-background text-foreground" value={newUser.roleId} onChange={e => setNewUser(f => ({ ...f, roleId: e.target.value }))} required>
              <option value="">{t('settings.role')}</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select className="border rounded-md px-3 py-2 text-sm bg-background text-foreground" value={newUser.departmentId} onChange={e => setNewUser(f => ({ ...f, departmentId: e.target.value }))}>
              <option value="">{t('users.department')}</option>
              {flatDepts(depts).map(d => <option key={d.id} value={d.id}>{'　'.repeat(d.depth) + d.name}</option>)}
            </select>
            <Button type="submit" disabled={creating}>{creating ? t('settings.creating') : t('settings.createUser')}</Button>
          </form>
          {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('settings.existingUsers')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 text-left">{t('settings.name')}</th>
                <th className="p-3 text-left">{t('settings.email')}</th>
                <th className="p-3 text-left">{t('settings.role')}</th>
                <th className="p-3 text-left">{t('users.department')}</th>
                <th className="p-3 text-left">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3"><Badge variant="outline">{u.role?.name || '-'}</Badge></td>
                  <td className="p-3">{u.department?.name || '-'}</td>
                  <td className="p-3 space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingUser(u); setEditForm({ name: u.name, roleId: u.role?.id || '', departmentId: u.department?.id || '' }); }}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleResetPwd(u.id)}><KeyRound className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteUserId(u.id)}><Trash2 className="h-3 w-3" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={o => { if (!o) setEditingUser(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('settings.editUser')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder={t('settings.name')} />
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground" value={editForm.roleId} onChange={e => setEditForm(f => ({ ...f, roleId: e.target.value }))}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground" value={editForm.departmentId} onChange={e => setEditForm(f => ({ ...f, departmentId: e.target.value }))}>
              <option value="">{t('users.noDepartment')}</option>
              {flatDepts(depts).map(d => <option key={d.id} value={d.id}>{'　'.repeat(d.depth) + d.name}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleEdit}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={o => { if (!o) setDeleteUserId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
          <p className="text-sm py-2">{t('settings.deleteUserConfirm', { name: deleteTarget?.name })}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Result Dialog */}
      <Dialog open={!!resetPwdResult} onOpenChange={o => { if (!o) setResetPwdResult(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('settings.resetPassword')}</DialogTitle></DialogHeader>
          <div className="py-4">
            <p className="text-sm mb-2">{t('settings.resetPasswordResult')}</p>
            <code className="block p-3 bg-muted rounded text-lg font-mono select-all">{resetPwdResult}</code>
          </div>
          <DialogFooter><Button onClick={() => setResetPwdResult(null)}>{t('common.confirm')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════
// Department Management
// ═══════════════════════════════════════════
function DepartmentManagement() {
  const { t } = useTranslation();
  const [tree, setTree] = useState<Dept[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editDept, setEditDept] = useState<Dept | null>(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', parentId: '', sortOrder: 0 });
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', code: '', parentId: '', sortOrder: 0 });
  const [deleteDeptId, setDeleteDeptId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/api/departments/tree').then(r => setTree(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const flatAll = (nodes: Dept[]): Dept[] => nodes.flatMap(n => [n, ...flatAll(n.children || [])]);

  const handleAdd = async () => {
    setError('');
    try {
      await api.post('/api/departments', { ...addForm, parentId: addForm.parentId || undefined });
      load(); setAddOpen(false); setAddForm({ name: '', code: '', parentId: '', sortOrder: 0 });
    } catch (e: any) { setError(e.response?.data?.error || t('settings.createFailed')); }
  };

  const handleEdit = async () => {
    if (!editDept) return;
    setError('');
    try {
      await api.put(`/api/departments/${editDept.id}`, { ...editForm, parentId: editForm.parentId || null });
      load(); setEditDept(null);
    } catch (e: any) { setError(e.response?.data?.error || t('settings.editFailed')); }
  };

  const handleDelete = async () => {
    if (!deleteDeptId) return;
    try { await api.delete(`/api/departments/${deleteDeptId}`); load(); } catch (e: any) { setError(e.response?.data?.error || t('settings.deleteFailed')); }
    setDeleteDeptId(null);
  };

  const renderNode = (node: Dept, depth: number) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    return (
      <div key={node.id}>
        <div className="flex items-center py-2 px-3 hover:bg-muted/30 rounded" style={{ paddingLeft: `${depth * 24 + 12}px` }}>
          <button onClick={() => toggle(node.id)} className="mr-2 w-4">
            {hasChildren ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="w-4" />}
          </button>
          <span className="flex-1 text-sm font-medium">{node.name}</span>
          <span className="text-xs text-muted-foreground mr-4">{t('departments.userCount', { count: node._count?.users || 0 })}</span>
          <Button variant="ghost" size="sm" onClick={() => { setEditDept(node); setEditForm({ name: node.name, code: node.code, parentId: node.parentId || '', sortOrder: node.sortOrder }); }}><Pencil className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteDeptId(node.id)}><Trash2 className="h-3 w-3" /></Button>
        </div>
        {hasChildren && isExpanded && node.children!.map(c => renderNode(c, depth + 1))}
      </div>
    );
  };

  const allFlat = flatAll(tree);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{t('departments.title')}</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />{t('departments.add')}</Button>
      </div>
      {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}
      <Card>
        <CardContent className="p-2">
          {tree.length === 0 ? <p className="text-sm text-muted-foreground p-4 text-center">{t('departments.empty')}</p> : tree.map(n => renderNode(n, 0))}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('departments.add')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('departments.name')}</label>
              <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('departments.code')}</label>
              <Input value={addForm.code} onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))} placeholder="如: tech-dept" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('departments.parent')}</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground" value={addForm.parentId} onChange={e => setAddForm(f => ({ ...f, parentId: e.target.value }))}>
                <option value="">{t('departments.none')}</option>
                {allFlat.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('departments.sortOrder')}</label>
              <Input type="number" value={addForm.sortOrder} onChange={e => setAddForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAdd}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDept} onOpenChange={o => { if (!o) setEditDept(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('departments.edit')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('departments.name')}</label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('departments.code')}</label>
              <Input value={editForm.code} onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('departments.parent')}</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground" value={editForm.parentId} onChange={e => setEditForm(f => ({ ...f, parentId: e.target.value }))}>
                <option value="">{t('departments.none')}</option>
                {allFlat.filter(d => d.id !== editDept?.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('departments.sortOrder')}</label>
              <Input type="number" value={editForm.sortOrder} onChange={e => setEditForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDept(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleEdit}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDeptId} onOpenChange={o => { if (!o) setDeleteDeptId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
          <p className="text-sm py-2">{t('departments.deleteConfirm')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDeptId(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════
// Role Management
// ═══════════════════════════════════════════
function RoleManagement() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permGroups, setPermGroups] = useState<Record<string, Perm[]>>({});
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', description: '', dataScope: 'self', permissionIds: [] as string[] });
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', code: '', description: '', dataScope: 'self', permissionIds: [] as string[] });
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/api/roles').then(r => setRoles(r.data.roles || r.data || [])).catch(() => {});
    api.get('/api/roles/permissions').then(r => setPermGroups(r.data || {})).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const DATA_SCOPES = [
    { value: 'all', label: t('roles.dataScope.all') },
    { value: 'department_and_children', label: t('roles.dataScope.department_and_children') },
    { value: 'department', label: t('roles.dataScope.department') },
    { value: 'self', label: t('roles.dataScope.self') },
  ];

  const togglePerm = (permId: string, form: any, setForm: any) => {
    setForm((f: any) => ({
      ...f,
      permissionIds: f.permissionIds.includes(permId)
        ? f.permissionIds.filter((id: string) => id !== permId)
        : [...f.permissionIds, permId],
    }));
  };

  const PermMatrix = ({ form, setForm }: { form: any; setForm: any }) => (
    <div className="space-y-3 max-h-60 overflow-auto">
      {Object.entries(permGroups).map(([module, perms]) => (
        <div key={module}>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{module}</p>
          <div className="flex flex-wrap gap-2">
            {(perms as Perm[]).map(p => (
              <label key={p.id} className="flex items-center gap-1 text-sm cursor-pointer">
                <input type="checkbox" checked={form.permissionIds.includes(p.id)} onChange={() => togglePerm(p.id, form, setForm)} className="rounded" />
                {p.name}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const handleAdd = async () => {
    setError('');
    try {
      await api.post('/api/roles', addForm);
      load(); setAddOpen(false); setAddForm({ name: '', code: '', description: '', dataScope: 'self', permissionIds: [] });
    } catch (e: any) { setError(e.response?.data?.error || t('settings.createFailed')); }
  };

  const handleEdit = async () => {
    if (!editRole) return;
    setError('');
    try {
      await api.put(`/api/roles/${editRole.id}`, editForm);
      load(); setEditRole(null);
    } catch (e: any) { setError(e.response?.data?.error || t('settings.editFailed')); }
  };

  const handleDelete = async () => {
    if (!deleteRoleId) return;
    try { await api.delete(`/api/roles/${deleteRoleId}`); load(); } catch (e: any) { setError(e.response?.data?.error || t('settings.deleteFailed')); }
    setDeleteRoleId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{t('roles.title')}</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />{t('roles.add')}</Button>
      </div>
      {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 text-left">{t('roles.name')}</th>
                <th className="p-3 text-left">{t('roles.code')}</th>
                <th className="p-3 text-left">{t('roles.dataScope')}</th>
                <th className="p-3 text-left">{t('roles.userCount')}</th>
                <th className="p-3 text-left">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id} className="border-b">
                  <td className="p-3 font-medium">{r.name} {r.isSystem && <Badge variant="secondary" className="ml-1 text-xs">{t('roles.builtIn')}</Badge>}</td>
                  <td className="p-3 text-muted-foreground">{r.code}</td>
                  <td className="p-3"><Badge variant="outline">{DATA_SCOPES.find(s => s.value === r.dataScope)?.label || r.dataScope}</Badge></td>
                  <td className="p-3">{r._count?.users || 0}</td>
                  <td className="p-3 space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditRole(r); setEditForm({ name: r.name, code: r.code, description: r.description || '', dataScope: r.dataScope, permissionIds: r.permissions?.map(p => p.id) || [] }); }}><Pencil className="h-3 w-3" /></Button>
                    {!r.isSystem && <Button variant="ghost" size="sm" onClick={() => setDeleteRoleId(r.id)}><Trash2 className="h-3 w-3" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add Role Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('roles.addTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('roles.name')}</label>
                <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('roles.code')}</label>
                <Input value={addForm.code} onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. editor" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('roles.description')}</label>
              <Input value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('roles.dataScope')}</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground" value={addForm.dataScope} onChange={e => setAddForm(f => ({ ...f, dataScope: e.target.value }))}>
                {DATA_SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('roles.permissions')}</label>
              <PermMatrix form={addForm} setForm={setAddForm} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAdd}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editRole} onOpenChange={o => { if (!o) setEditRole(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('roles.editTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('roles.name')}</label>
                <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} disabled={editRole?.isSystem} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('roles.code')}</label>
                <Input value={editForm.code} onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} disabled={editRole?.isSystem} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('roles.description')}</label>
              <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('roles.dataScope')}</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground" value={editForm.dataScope} onChange={e => setEditForm(f => ({ ...f, dataScope: e.target.value }))}>
                {DATA_SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('roles.permissions')}</label>
              <PermMatrix form={editForm} setForm={setEditForm} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleEdit}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={!!deleteRoleId} onOpenChange={o => { if (!o) setDeleteRoleId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
          <p className="text-sm py-2">{t('roles.deleteConfirm')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRoleId(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════
// APNs Settings
// ═══════════════════════════════════════════
function ApnsSettings() {
  const { t } = useTranslation();
  const [apns, setApns] = useState<{ keyId: string; teamId: string; keyPath: string; topic: string; keyFileExists: boolean } | null>(null);
  const [form, setForm] = useState({ keyId: '', teamId: '', keyPath: '', topic: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/api/settings/apns').then(r => {
      setApns(r.data);
      setForm({ keyId: r.data.keyId || '', teamId: r.data.teamId || '', keyPath: r.data.keyPath || '', topic: r.data.topic || '' });
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.put('/api/settings/apns', form);
      setMsg(t('settings.saveSuccess'));
      api.get('/api/settings/apns').then(r => setApns(r.data)).catch(() => {});
    } catch { setMsg(t('settings.saveFailed')); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>{t('settings.apnsConfig')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Key ID</label>
            <Input value={form.keyId} onChange={e => setForm(f => ({ ...f, keyId: e.target.value }))} placeholder="XXXXXXXXXX" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Team ID</label>
            <Input value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} placeholder="XXXXXXXXXX" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.keyFilePath')}</label>
            <Input value={form.keyPath} onChange={e => setForm(f => ({ ...f, keyPath: e.target.value }))} placeholder="/path/to/AuthKey.p8" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Topic</label>
            <Input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="com.example.mdm" />
          </div>
        </div>
        {apns && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('settings.keyFileStatus')}</span>
            <Badge variant={apns.keyFileExists ? 'default' : 'destructive'}>
              {apns.keyFileExists ? t('settings.keyFileExists') : t('settings.keyFileMissing')}
            </Badge>
          </div>
        )}
        {msg && <div className={`p-3 text-sm rounded-md ${msg === t('settings.saveSuccess') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{msg}</div>}
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? t('settings.saving') : t('settings.saveConfig')}</Button>
        <p className="text-sm text-muted-foreground">{t('settings.apnsHint')}</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════
// SMTP Settings
// ═══════════════════════════════════════════
function SmtpSettings() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ host: '', port: '587', user: '', pass: '', from: '', secure: 'false' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/api/settings/smtp').then(r => {
      setForm(f => ({ ...f, host: r.data.host || '', port: r.data.port || '587', user: r.data.user || '', from: r.data.from || '', secure: r.data.secure || 'false' }));
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.put('/api/settings/smtp', form);
      setMsg(t('settings.saveSuccess'));
    } catch { setMsg(t('settings.saveFailed')); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>{t('smtp.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('smtp.host')}</label>
            <Input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="smtp.example.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('smtp.port')}</label>
            <Input value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="587" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('smtp.username')}</label>
            <Input value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))} placeholder="user@example.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('smtp.password')}</label>
            <Input type="password" value={form.pass} onChange={e => setForm(f => ({ ...f, pass: e.target.value }))} placeholder="••••••" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('smtp.from')}</label>
            <Input value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} placeholder="noreply@example.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('smtp.ssl')}</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.secure === 'true'} onChange={e => setForm(f => ({ ...f, secure: e.target.checked ? 'true' : 'false' }))} className="rounded" />
              <span className="text-sm">{t('smtp.enableSecure')}</span>
            </label>
          </div>
        </div>
        {msg && <div className={`p-3 text-sm rounded-md ${msg === t('settings.saveSuccess') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{msg}</div>}
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? t('settings.saving') : t('settings.saveConfig')}</Button>
          <Button variant="outline" onClick={async () => {
            try {
              await api.post('/api/settings/smtp/test');
              setMsg(t('smtp.testSuccess'));
            } catch { setMsg(t('smtp.testFailed')); }
          }} disabled={saving}>
            <Mail className="h-4 w-4 mr-2" />{t('smtp.testEmail')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
