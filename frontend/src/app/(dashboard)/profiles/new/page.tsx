'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';

const PAYLOAD_TYPES = ['WiFi', 'VPN', 'Email', 'Passcode', 'Restrictions', 'Certificate', 'APN', 'General'];

const PAYLOAD_TEMPLATES: Record<string, { payloadType: string; payload: Record<string, any> }> = {
  wifi: {
    payloadType: 'com.apple.wifi.managed',
    payload: { SSID_STR: '', EncryptionType: 'WPA2', AutoJoin: true, IsHotspot: false },
  },
  vpn: {
    payloadType: 'com.apple.vpn.managed',
    payload: { VPNType: 'IKEv2', RemoteAddress: '', LocalIdentifier: '', RemoteIdentifier: '', AuthenticationMethod: 'Certificate' },
  },
  email: {
    payloadType: 'com.apple.mail.managed',
    payload: { EmailAccountType: 'EmailTypeIMAP', IncomingMailServerHostName: '', IncomingMailServerPortNumber: 993, IncomingMailServerUseSSL: true, OutgoingMailServerHostName: '', OutgoingMailServerPortNumber: 587, OutgoingMailServerUseSSL: true },
  },
  restrictions: {
    payloadType: 'com.apple.applicationaccess',
    payload: { allowCamera: true, allowScreenShot: true, allowAppInstallation: true, allowAppRemoval: false, allowSafari: true, allowAirDrop: false },
  },
  passcode: {
    payloadType: 'com.apple.mobiledevice.passwordpolicy',
    payload: { allowSimple: false, forcePIN: true, minLength: 6, maxInactivity: 5, maxPINAgeInDays: 90, requireAlphanumeric: false },
  },
};

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
      setError(err?.response?.data?.error || t('settings.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/profiles')}>
          <ArrowLeft className="h-4 w-4 mr-2" />{t('common.back')}
        </Button>
        <h1 className="text-2xl font-bold">{t('profiles.createTitle')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('profiles.info')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{'配置模板（可选）'}</label>
              <select
                onChange={e => {
                  const tpl = PAYLOAD_TEMPLATES[e.target.value];
                  if (tpl) {
                    setForm(f => ({ ...f, payloadType: tpl.payloadType, payload: JSON.stringify(tpl.payload, null, 2) }));
                  }
                }}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">{'选择模板...'}</option>
                <option value="wifi">WiFi</option>
                <option value="vpn">VPN</option>
                <option value="email">Email</option>
                <option value="restrictions">{'访问限制'}</option>
                <option value="passcode">{'密码策略'}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t('profiles.name')} *</label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder={t('profiles.namePlaceholder')}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t('profiles.identifier')} *</label>
              <Input
                value={form.identifier}
                onChange={e => set('identifier', e.target.value)}
                placeholder="com.example.wifi"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t('profiles.payloadType')} *</label>
              <select
                value={form.payloadType}
                onChange={e => set('payloadType', e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {PAYLOAD_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t('profiles.description')}</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder={t('profiles.descriptionPlaceholder')}
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
              <Button type="submit" disabled={saving}>{saving ? t('common.creating') : t('common.create')}</Button>
              <Button type="button" variant="outline" onClick={() => router.push('/profiles')}>{t('common.cancel')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
