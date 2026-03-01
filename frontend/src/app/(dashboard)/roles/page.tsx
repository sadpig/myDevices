'use client';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { PERMISSION_MODULES, DATA_SCOPE_LABELS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
}

interface RolePermission {
  permission: Permission;
}

interface Role {
  id: string;
  name: string;
  code: string;
  description: string | null;
  dataScope: string;
  allowedProfileTypes: string[];
  isSystem: boolean;
  permissions: RolePermission[];
  _count: { users: number };
}

interface PermissionsByModule {
  [module: string]: Permission[];
}

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  dataScope: 'all',
  allowedProfileTypes: '',
};

export default function RolesPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permsByModule, setPermsByModule] = useState<PermissionsByModule>({});
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadRoles = useCallback(() => {
    api.get('/api/roles').then(res => setRoles(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/roles'),
      api.get('/api/roles/permissions'),
    ]).then(([rolesRes, permsRes]) => {
      setRoles(rolesRes.data || []);
      setPermsByModule(permsRes.data || {});
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditingRole(null);
    setForm(EMPTY_FORM);
    setSelectedPerms(new Set());
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      code: role.code,
      description: role.description || '',
      dataScope: role.dataScope,
      allowedProfileTypes: role.allowedProfileTypes?.join(',') || '',
    });
    setSelectedPerms(new Set(role.permissions.map(rp => rp.permission.id)));
    setFormError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.name.trim()) { setFormError(t('roles.nameRequired')); return; }
    if (!editingRole && !form.code.trim()) { setFormError(t('roles.codeRequired')); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        dataScope: form.dataScope,
        permissionIds: Array.from(selectedPerms),
        allowedProfileTypes: form.allowedProfileTypes
          ? form.allowedProfileTypes.split(',').map(s => s.trim()).filter(Boolean)
          : undefined,
      };
      if (!editingRole) {
        payload.code = form.code.trim();
        await api.post('/api/roles', payload);
      } else {
        await api.put(`/api/roles/${editingRole.id}`, payload);
      }
      setDialogOpen(false);
      loadRoles();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRole) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/api/roles/${deleteRole.id}`);
      setDeleteRole(null);
      loadRoles();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error || t('roles.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const allPermIds = Object.values(permsByModule).flat().map(p => p.id);

  const togglePerm = (id: string) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleModule = (module: string) => {
    const ids = (permsByModule[module] || []).map(p => p.id);
    const allSelected = ids.every(id => selectedPerms.has(id));
    setSelectedPerms(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const selectAll = () => setSelectedPerms(new Set(allPermIds));
  const clearAll = () => setSelectedPerms(new Set());

  const canWrite = hasPermission('role:write');
  const canDelete = hasPermission('role:delete');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('roles.title')}</h1>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t('roles.create')}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="p-3 text-left">{t('roles.name')}</th>
                  <th className="p-3 text-left">{t('roles.code')}</th>
                  <th className="p-3 text-left">{t('roles.description')}</th>
                  <th className="p-3 text-left">{t('roles.dataScope')}</th>
                  <th className="p-3 text-left">{t('roles.permissionCount')}</th>
                  <th className="p-3 text-left">{t('roles.userCount')}</th>
                  <th className="p-3 text-left">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <tr key={role.id} className="border-b hover:bg-muted/20">
                    <td className="p-3 font-medium">
                      <span className="flex items-center gap-2">
                        {role.isSystem && <Shield className="h-4 w-4 text-muted-foreground" />}
                        {role.name}
                        {role.isSystem && <Badge variant="secondary">{t('roles.system')}</Badge>}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs">{role.code}</td>
                    <td className="p-3 text-muted-foreground">{role.description || '-'}</td>
                    <td className="p-3">
                      <Badge variant="outline">{DATA_SCOPE_LABELS[role.dataScope] || role.dataScope}</Badge>
                    </td>
                    <td className="p-3">{role.permissions.length}</td>
                    <td className="p-3">{role._count.users}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {canWrite && (
                          <Button variant="ghost" size="sm" onClick={() => openEdit(role)} title={t('common.edit')}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && !role.isSystem && (
                          <Button variant="ghost" size="sm" onClick={() => { setDeleteRole(role); setDeleteError(''); }} title={t('common.delete')}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-muted-foreground">{t('roles.noRoles')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? t('roles.edit') : t('roles.create')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('roles.name')} *</label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('roles.namePlaceholder')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('roles.code')} *</label>
                <Input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. device_admin"
                  readOnly={!!editingRole}
                  className={editingRole ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t('roles.description')}</label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('roles.descriptionPlaceholder')}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t('roles.dataScope')}</label>
              <select
                value={form.dataScope}
                onChange={e => setForm(f => ({ ...f, dataScope: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {Object.entries(DATA_SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t('roles.allowedProfileTypes')}</label>
              <Input
                value={form.allowedProfileTypes}
                onChange={e => setForm(f => ({ ...f, allowedProfileTypes: e.target.value }))}
                placeholder="e.g. wifi,vpn,email"
              />
            </div>

            {/* Permission Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t('roles.permissionConfig')}</label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAll}>{t('roles.selectAll')}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearAll}>{t('roles.clearAll')}</Button>
                </div>
              </div>

              <div className="border rounded-md divide-y">
                {Object.entries(permsByModule).map(([module, perms]) => {
                  const modulePermsIds = perms.map(p => p.id);
                  const allChecked = modulePermsIds.every(id => selectedPerms.has(id));
                  const someChecked = modulePermsIds.some(id => selectedPerms.has(id));
                  return (
                    <div key={module} className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                          onChange={() => toggleModule(module)}
                          className="h-4 w-4 cursor-pointer"
                        />
                        <span className="text-sm font-medium">
                          {PERMISSION_MODULES[module] || module}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({modulePermsIds.filter(id => selectedPerms.has(id)).length}/{perms.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pl-6">
                        {perms.map(perm => (
                          <label key={perm.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedPerms.has(perm.id)}
                              onChange={() => togglePerm(perm.id)}
                              className="h-3.5 w-3.5"
                            />
                            {perm.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.keys(permsByModule).length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground text-center">{t('roles.noPermissions')}</p>
                )}
              </div>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteRole} onOpenChange={open => { if (!open) setDeleteRole(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2">
            {t('roles.deleteConfirm', { name: deleteRole?.name })}
          </p>
          {deleteRole && deleteRole._count.users > 0 && (
            <p className="text-sm text-amber-600">
              {t('roles.deleteHasUsers', { count: deleteRole._count.users })}
            </p>
          )}
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRole(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t('roles.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
