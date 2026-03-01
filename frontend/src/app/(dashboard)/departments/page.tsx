'use client';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Building2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  sortOrder: number;
  _count: { users: number };
  children: Department[];
}

interface FlatDepartment {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
}

interface DeptForm {
  name: string;
  code: string;
  parentId: string;
  sortOrder: string;
}

const emptyForm: DeptForm = { name: '', code: '', parentId: '', sortOrder: '0' };

function DeptNode({
  node,
  depth,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  canWrite,
}: {
  node: Department;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (node: Department) => void;
  onDelete: (node: Department) => void;
  canWrite: boolean;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="group flex items-center gap-2 py-2 pr-3 hover:bg-muted/40 rounded-md cursor-default"
        style={{ paddingLeft: `${12 + depth * 24}px` }}
      >
        <button
          className="w-4 h-4 flex items-center justify-center text-muted-foreground shrink-0"
          onClick={() => hasChildren && onToggle(node.id)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-4 h-4" />
          )}
        </button>
        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm">{node.name}</span>
        <span className="text-xs text-muted-foreground font-mono">{node.code}</span>
        <Badge variant="secondary" className="text-xs ml-1">{node._count.users} 人</Badge>
        {canWrite && (
          <div className="ml-auto hidden group-hover:flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(node)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => onDelete(node)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
      {isExpanded && hasChildren && node.children.map(child => (
        <DeptNode
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          canWrite={canWrite}
        />
      ))}
    </div>
  );
}

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('dept:write');

  const [tree, setTree] = useState<Department[]>([]);
  const [flatList, setFlatList] = useState<FlatDepartment[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const [form, setForm] = useState<DeptForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const loadTree = useCallback(() => {
    api.get('/api/departments/tree')
      .then(res => {
        const data: Department[] = res.data.departments ?? res.data ?? [];
        setTree(data);
        setExpanded(prev => {
          const next = new Set(prev);
          data.forEach(d => next.add(d.id));
          return next;
        });
      })
      .catch(() => setError(t('departments.loadFailed')));
  }, []);

  const loadFlat = useCallback(() => {
    api.get('/api/departments')
      .then(res => setFlatList(res.data.departments ?? res.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadTree(); loadFlat(); }, [loadTree, loadFlat]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openCreate = () => {
    setForm(emptyForm);
    setDialogError('');
    setCreateOpen(true);
  };

  const openEdit = (node: Department) => {
    setForm({
      name: node.name,
      code: node.code,
      parentId: node.parentId ?? '',
      sortOrder: String(node.sortOrder),
    });
    setDialogError('');
    setEditTarget(node);
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setDialogError(t('departments.nameCodeRequired'));
      return;
    }
    setSaving(true);
    setDialogError('');
    try {
      await api.post('/api/departments', {
        name: form.name.trim(),
        code: form.code.trim(),
        ...(form.parentId ? { parentId: form.parentId } : {}),
        sortOrder: Number(form.sortOrder) || 0,
      });
      setCreateOpen(false);
      loadTree();
      loadFlat();
    } catch (e: any) {
      setDialogError(e?.response?.data?.error ?? t('settings.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!form.name.trim() || !form.code.trim()) {
      setDialogError(t('departments.nameCodeRequired'));
      return;
    }
    setSaving(true);
    setDialogError('');
    try {
      await api.put(`/api/departments/${editTarget.id}`, {
        name: form.name.trim(),
        code: form.code.trim(),
        parentId: form.parentId || null,
        sortOrder: Number(form.sortOrder) || 0,
      });
      setEditTarget(null);
      loadTree();
      loadFlat();
    } catch (e: any) {
      setDialogError(e?.response?.data?.error ?? t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setDialogError('');
    try {
      await api.delete(`/api/departments/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadTree();
      loadFlat();
    } catch (e: any) {
      setDialogError(e?.response?.data?.error ?? t('roles.deleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const FormFields = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('departments.name')}</label>
        <Input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder={t('departments.namePlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('departments.code')}</label>
        <Input
          value={form.code}
          onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
          placeholder={t('departments.codePlaceholder')}
          className="font-mono"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('departments.parent')}</label>
        <select
          value={form.parentId}
          onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="">{t('departments.noParent')}</option>
          {flatList
            .filter(d => !editTarget || d.id !== editTarget.id)
            .map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('departments.sortOrder')}</label>
        <Input
          type="number"
          value={form.sortOrder}
          onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
          placeholder="0"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">部门管理</h1>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            新建部门
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">部门树</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {tree.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无部门数据</p>
          ) : (
            <div className="space-y-0.5">
              {tree.map(node => (
                <DeptNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggle}
                  onEdit={openEdit}
                  onDelete={n => { setDialogError(''); setDeleteTarget(n); }}
                  canWrite={canWrite}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={open => { if (!open) setCreateOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建部门</DialogTitle>
          </DialogHeader>
          <FormFields />
          {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? '保存中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑部门</DialogTitle>
          </DialogHeader>
          <FormFields />
          {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>取消</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2">
            确定要删除部门 <span className="font-medium">{deleteTarget?.name}</span> 吗？若该部门下有子部门或用户则无法删除。
          </p>
          {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
