// Device types
export type DeviceType = 'iPhone' | 'iPad' | 'Mac' | 'AppleTV' | 'AppleWatch' | 'VisionPro';
export type EnrollmentStatus = 'pending' | 'enrolled' | 'unenrolled';
export type AssetStatus = 'in_use' | 'in_stock' | 'repairing' | 'retired' | 'lost';
export type UserRole = 'super_admin' | 'device_admin' | 'readonly';
export type CommandStatus = 'queued' | 'sent' | 'acknowledged' | 'error' | 'not_now';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Device {
  id: string;
  udid: string;
  serialNumber: string;
  deviceType: DeviceType;
  model?: string;
  modelName?: string;
  osVersion?: string;
  deviceName?: string;
  enrollmentStatus: EnrollmentStatus;
  lastSeenAt?: string;
  mdmEnrolled: boolean;
  supervised: boolean;
  createdAt: string;
  asset?: Asset;
}

export interface Asset {
  id: string;
  deviceId: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyEnd?: string;
  assignedTo?: string;
  department?: string;
  location?: string;
  status: AssetStatus;
  notes?: string;
  device?: Device;
}

export interface MDMCommand {
  id: string;
  deviceId: string;
  commandType: string;
  payload?: Record<string, unknown>;
  status: CommandStatus;
  requestId: string;
  queuedAt: string;
  sentAt?: string;
  acknowledgedAt?: string;
  result?: Record<string, unknown>;
}

export interface Profile {
  id: string;
  name: string;
  identifier: string;
  payloadType: string;
  payload: Record<string, unknown>;
  description?: string;
  createdAt: string;
  _count?: { devices: number };
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  user?: { name: string; email: string };
}

// API response types
export interface DeviceListResponse {
  devices: Device[];
  total: number;
  page: number;
  limit: number;
}

export interface AssetListResponse {
  assets: Asset[];
  total: number;
  page: number;
  limit: number;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}
