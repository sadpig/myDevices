'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const roleLabels: Record<string, string> = {
  super_admin: '超级管理员', device_admin: '设备管理员', readonly: '只读用户',
};

export default function SettingsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'readonly' });
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  const loadUsers = () => {
    api.get('/api/auth/me').then(res => {
      setUsers([res.data]);
    }).catch(() => {});
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage('');
    try {
      await api.post('/api/auth/register', newUser);
      setMessage('用户创建成功');
      setNewUser({ email: '', name: '', password: '', role: 'readonly' });
    } catch {
      setMessage('创建失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系统设置</h1>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="apns">APNs 证书</TabsTrigger>
          <TabsTrigger value="system">系统信息</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>创建用户</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                {message && <div className="p-3 text-sm bg-blue-50 text-blue-600 rounded-md">{message}</div>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">邮箱</label>
                    <Input type="email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">姓名</label>
                    <Input value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">密码</label>
                    <Input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">角色</label>
                    <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                      <option value="readonly">只读用户</option>
                      <option value="device_admin">设备管理员</option>
                      <option value="super_admin">超级管理员</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" disabled={creating}>{creating ? '创建中...' : '创建用户'}</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apns" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>APNs 推送证书配置</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Key ID</label>
                <Input placeholder="APNs Key ID" disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Team ID</label>
                <Input placeholder="Apple Developer Team ID" disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Key 文件路径</label>
                <Input placeholder=".p8 文件路径" disabled />
              </div>
              <p className="text-sm text-muted-foreground">APNs 证书配置需要在服务端 .env 文件中设置 APNS_KEY_ID、APNS_TEAM_ID、APNS_KEY_PATH</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>系统信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">系统名称</span><span>myDevices</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">版本</span><span>1.0.0</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">前端</span><span>Next.js 14 + shadcn/ui</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">后端</span><span>Fastify + TypeScript + Prisma</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">数据库</span><span>PostgreSQL + Redis</span></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
