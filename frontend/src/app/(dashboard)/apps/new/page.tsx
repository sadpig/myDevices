'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function NewAppPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [form, setForm] = useState({
    bundleId: '', name: '', version: '', category: '', source: '', managedApp: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/api/apps', {
        ...form,
        version: form.version || undefined,
        category: form.category || undefined,
        source: form.source || undefined,
      });
      router.push('/apps');
    } catch (err: any) {
      setError(err?.response?.data?.error || t('common.operationFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t('apps.new')}</h1>
      <Card>
        <CardHeader><CardTitle>{t('apps.detail')}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('apps.bundleId')} *</label>
              <Input value={form.bundleId} onChange={e => setForm(f => ({ ...f, bundleId: e.target.value }))} required placeholder="com.example.app" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('apps.name')} *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('apps.version')}</label>
                <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0.0" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('apps.category')}</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground">
                  <option value="">-</option>
                  {['productivity', 'utility', 'education', 'business', 'other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('apps.source')}</label>
              <Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="App Store / Enterprise / Custom" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="managedApp" checked={form.managedApp} onChange={e => setForm(f => ({ ...f, managedApp: e.target.checked }))} className="h-4 w-4" />
              <label htmlFor="managedApp" className="text-sm">{t('apps.managedApp')}</label>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>{t('common.cancel')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
