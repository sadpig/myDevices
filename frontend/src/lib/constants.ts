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

export const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  pending: '待注册',
  enrolled: '已注册',
  unenrolled: '已注销',
};

export const ASSET_STATUS_LABELS: Record<string, string> = {
  in_use: '使用中',
  in_stock: '库存',
  repairing: '维修中',
  retired: '已退役',
  lost: '丢失',
};

export const ASSET_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  in_use: 'default',
  in_stock: 'secondary',
  repairing: 'outline',
  retired: 'secondary',
  lost: 'destructive',
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  device_admin: '设备管理员',
  readonly: '只读用户',
};

export const DEVICE_TYPES = ['iPhone', 'iPad', 'Mac', 'AppleTV', 'AppleWatch', 'VisionPro'];
