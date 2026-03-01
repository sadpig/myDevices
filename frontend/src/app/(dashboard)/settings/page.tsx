'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Trash2, Save } from 'lucide-react';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'readonly' });
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [apns, setApns] = useState<{ keyId: string; teamId: string; keyPath: string; topic: string; keyFileExists: boolean } | null>(null);

  const [editingUser, setEditingUser] = useState<any>(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', role: '' });
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const [apnsForm, setApnsForm] = useState({ keyId: '', teamId: '', keyPath: '', topic: '' });
  const [apnsSaving, setApnsSaving] = useState(false);
  const [apnsMessage, setApnsMessage] = useState('');

  const loadApns = () => {
    api.get('/api/settings/apns').then(res => setApns(res.data)).catch(() => {});
  };

  const loadUsers = () => {
    api.get('/api/auth/users').then(res => {
      setUsers(res.data.users || []);
    }).catch(() => {
      api.get('/api/auth/me').then(res => {
        setUsers([res.data]);
      }).catch(() => {});
    });
  };

  useEffect(() => { loadUsers(); loadApns(); }, []);

  useEffect(() => {
    if (apns) {
      setApnsForm({
        keyId: apns.keyId || '',
        teamId: apns.teamId || '',
        keyPath: apns.keyPath || '',
        topic: apns.topic || '',
      });
    }
  }, [apns]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage('');
    try {
      await api.post('/api/auth/register', newUser);
      setMessage(t('settings.userCreated'));
      loadUsers();
      setNewUser({ email: '', name: '', password: '', role: 'readonly' });
    } catch {
      setMessage(t('settings.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    try {
      await api.put(`/api/auth/users/${editingUser.id}`, editUserForm);
      loadUsers();
      setEditingUser(null);
    } catch {
      setMessage(t('settings.editFailed'));
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      await api.delete(`/api/auth/users/${deleteUserId}`);
      loadUsers();
      setDeleteUserId(null);
    } catch {
      setMessage(t('settings.deleteFailed'));
      setDeleteUserId(null);
    }
  };

  const handleSaveApns = async () => {
    setApnsSaving(true);
    setApnsMessage('');
    try {
      await api.put('/api/settings/apns', apnsForm);
      setApnsMessage(t('settings.saveSuccess'));
      loadApns();
    } catch {
      setApnsMessage(t('settings.saveFailed'));
    } finally {
      setApnsSaving(false);
    }
  };

  const deleteTarget = users.find(u => u.id === deleteUserId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t('settings.userManagement')}</TabsTrigger>
          <TabsTrigger value="apns">{t('settings.apnsCert')}</TabsTrigger>
          <TabsTrigger value="system">{t('settings.systemInfo')}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t('settings.createUser')}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                {message && <div className="p-3 text-sm bg-blue-50 text-blue-600 rounded-md">{message}</div>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('settings.email')}</label>
                    <Input type="email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('settings.name')}</label>
                    <Input value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('settings.password')}</label>
                    <Input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('settings.role')}</label>
                    <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                      <option value="readonly">{t('roles.readonly')}</option>
                      <option value="device_admin">{t('roles.device_admin')}</option>
                      <option value="super_admin">{t('roles.super_admin')}</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" disabled={creating}>{creating ? t('settings.creating') : t('settings.createUser')}</Button>
              </form>
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-3">{t('settings.existingUsers')}</h3>
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="p-2 text-left">{t('settings.name')}</th>
                      <th className="p-2 text-left">{t('settings.email')}</th>
                      <th className="p-2 text-left">{t('settings.role')}</th>
                      <th className="p-2 text-left">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u: any) => (
                      <tr key={u.id} className="border-b hover:bg-muted/20">
                        <td className="p-2">{u.name}</td>
                        <td className="p-2">{u.email}</td>
                        <td className="p-2"><Badge>{t('roles.' + u.role) || u.role}</Badge></td>
                        <td className="p-2 flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingUser(u); setEditUserForm({ name: u.name, role: u.role }); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteUserId(u.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apns" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t('settings.apnsConfig')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Key ID</label>
                  <Input value={apnsForm.keyId} onChange={e => setApnsForm(f => ({ ...f, keyId: e.target.value }))} placeholder="XXXXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Team ID</label>
                  <Input value={apnsForm.teamId} onChange={e => setApnsForm(f => ({ ...f, teamId: e.target.value }))} placeholder="XXXXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('settings.keyFilePath')}</label>
                  <Input value={apnsForm.keyPath} onChange={e => setApnsForm(f => ({ ...f, keyPath: e.target.value }))} placeholder="/path/to/AuthKey_XXXXXXXXXX.p8" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Topic</label>
                  <Input value={apnsForm.topic} onChange={e => setApnsForm(f => ({ ...f, topic: e.target.value }))} placeholder="com.example.app" />
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
              {apnsMessage && (
                <div className={`p-3 text-sm rounded-md ${apnsMessage === t('settings.saveSuccess') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {apnsMessage}
                </div>
              )}
              <Button onClick={handleSaveApns} disabled={apnsSaving}>
                <Save className="h-4 w-4 mr-2" />
                {apnsSaving ? t('settings.saving') : t('settings.saveConfig')}
              </Button>
              <p className="text-sm text-muted-foreground">
                {t('settings.apnsHint')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t('settings.systemInfo')}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('settings.systemName')}</span><span>myDevices</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('settings.version')}</span><span>1.0.0</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('settings.frontend')}</span><span>Next.js 14 + shadcn/ui</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('settings.backend')}</span><span>Fastify + TypeScript + Prisma</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('settings.database')}</span><span>PostgreSQL + Redis</span></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={open => { if (!open) setEditingUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.editUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.name')}</label>
              <Input value={editUserForm.name} onChange={e => setEditUserForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.role')}</label>
              <select value={editUserForm.role} onChange={e => setEditUserForm(f => ({ ...f, role: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="super_admin">{t('roles.super_admin')}</option>
                <option value="device_admin">{t('roles.device_admin')}</option>
                <option value="readonly">{t('roles.readonly')}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleEditUser}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={open => { if (!open) setDeleteUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2">{t('settings.deleteUserConfirm', { name: deleteTarget?.name })}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDeleteUser}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
