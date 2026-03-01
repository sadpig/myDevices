'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PAYLOAD_TYPES = ['WiFi', 'VPN', 'Email', 'Passcode', 'Restrictions', 'Certificate', 'APN', 'General'];

export default function NewProfilePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    identifier: '',
    payloadType: 'WiFi',
    description: '',
    payload: '{}',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let parsedPayload: object;
    try {
      parsedPayload = JSON.parse(form.payload);
    } catch {
      setError(t('profiles.invalidJson'));
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/profiles', {
        name: form.name,
        identifier: form.identifier,
        payloadType: form.payloadType,
        description: form.description || undefined,
        payload: parsedPayload,
      });
      router.push('/profiles');
    } catch (err: any) {
      setError(err?.response?.data?.error || '创建失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/profiles')}>
          <ArrowLeft className="h-4 w-4 mr-2" />返回
        </Button>
        <h1 className="text-2xl font-bold">新建配置描述文件</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>配置信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">名称 *</label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="配置描述文件名称"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">标识符 *</label>
              <Input
                value={form.identifier}
                onChange={e => set('identifier', e.target.value)}
                placeholder="com.example.wifi"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">负载类型 *</label>
              <select
                value={form.payloadType}
                onChange={e => set('payloadType', e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {PAYLOAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">描述</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="可选描述"
                rows={2}
                className="w-full border rounded-md px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Payload (JSON) *</label>
              <textarea
                value={form.payload}
                onChange={e => set('payload', e.target.value)}
                rows={6}
                className="w-full border rounded-md px-3 py-2 text-sm font-mono resize-y"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>{saving ? '创建中...' : '创建'}</Button>
              <Button type="button" variant="outline" onClick={() => router.push('/profiles')}>取消</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
