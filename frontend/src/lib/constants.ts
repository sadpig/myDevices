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

export const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  user: '普通用户',
};

export const PERMISSION_MODULES: Record<string, string> = {
  dashboard: '仪表盘',
  device: '设备管理',
  asset: '资产管理',
  profile: '配置文件',
  mdm: 'MDM 命令',
  audit: '审计日志',
  report: '报表',
  user: '人员管理',
  department: '部门管理',
  role: '角色管理',
  settings: '系统设置',
};

export const DATA_SCOPE_LABELS: Record<string, string> = {
  all: '全部数据',
  department_and_children: '本部门及下级',
  department: '仅本部门',
  self: '仅本人',
};
