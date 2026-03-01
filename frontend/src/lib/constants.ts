import type React from 'react';
import { Smartphone, Tablet, Monitor, Tv, Watch, Glasses } from 'lucide-react';

export const DEVICE_ICONS: Record<string, React.ElementType> = {
  iPhone: Smartphone,
  iPad: Tablet,
  Mac: Monitor,
  AppleTV: Tv,
  AppleWatch: Watch,
  VisionPro: Glasses,
};

export const ASSET_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  in_use: 'default',
  in_stock: 'secondary',
  repairing: 'outline',
  retired: 'secondary',
  lost: 'destructive',
};

export const DEVICE_TYPES = ['iPhone', 'iPad', 'Mac', 'AppleTV', 'AppleWatch', 'VisionPro'];
