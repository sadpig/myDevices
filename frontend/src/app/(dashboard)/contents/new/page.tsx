'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export default function NewContentPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: '', type: 'document', description: '', version: '' });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('type', form.type);
      if (form.description) formData.append('description', form.description);
      if (form.version) formData.append('version', form.version);
      if (file) formData.append('file', file);
      await api.post('/api/contents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      router.push('/contents');
    } catch (err: any) {
      setError(err?.response?.data?.error || t('common.operationFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t('contents.new')}</h1>
      <Card>
        <CardHeader><CardTitle>{t('contents.detail')}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('contents.name')} *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('contents.type')}</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground">
                  {['document', 'book', 'media'].map(t2 => (
                    <option key={t2} value={t2}>{t(`contents.types.${t2}`)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('contents.version')}</label>
                <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('contents.description')}</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] bg-background text-foreground"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('contents.uploadFile')}</label>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />{t('common.upload', 'Upload')}
                </Button>
                <span className="text-sm text-muted-foreground">{file ? file.name : t('common.none', 'No file selected')}</span>
                <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
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
