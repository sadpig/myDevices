'use client';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';

interface Device {
  id: string;
  deviceName: string | null;
  serialNumber: string;
  modelName: string | null;
  deviceType: string;
}

interface DevicePickerProps {
  value: string;
  onChange: (deviceId: string) => void;
}

export function DevicePicker({ value, onChange }: DevicePickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Device[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Device | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      api.get(`/api/devices/search?q=${encodeURIComponent(query)}`)
        .then(res => { setResults(res.data.devices || []); setOpen(true); })
        .catch(() => setResults([]));
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (device: Device) => {
    setSelected(device);
    onChange(device.id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    onChange('');
    setQuery('');
  };

  if (selected || value) {
    return (
      <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-background">
        <span className="flex-1 truncate">
          {selected ? `${selected.deviceName || selected.serialNumber} (${selected.serialNumber})` : value}
        </span>
        <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
          &times;
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={t('assets.searchDevice')}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full border rounded-md bg-popover shadow-lg max-h-60 overflow-auto">
          {results.map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => handleSelect(d)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <div className="font-medium">{d.deviceName || d.serialNumber}</div>
              <div className="text-xs text-muted-foreground">{d.serialNumber} &middot; {d.modelName || d.deviceType}</div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full border rounded-md bg-popover shadow-lg p-3 text-sm text-muted-foreground">
          {t('common.noResults')}
        </div>
      )}
    </div>
  );
}
