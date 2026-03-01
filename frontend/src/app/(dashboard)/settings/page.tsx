'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [apns, setApns] = useState<{ keyId: string; teamId: string; keyPath: string; topic: string; keyFileExists: boolean } | null>(null);

  const [apnsForm, setApnsForm] = useState({ keyId: '', teamId: '', keyPath: '', topic: '' });
  const [apnsSaving, setApnsSaving] = useState(false);
  const [apnsMessage, setApnsMessage] = useState('');

  const loadApns = () => {
    api.get('/api/settings/apns').then(res => setApns(res.data)).catch(() => {});
  };

  useEffect(() => { loadApns(); }, []);

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <Tabs defaultValue="apns">
        <TabsList>
          <TabsTrigger value="apns">{t('settings.apnsCert')}</TabsTrigger>
          <TabsTrigger value="system">{t('settings.systemInfo')}</TabsTrigger>
        </TabsList>

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
    </div>
  );
}
