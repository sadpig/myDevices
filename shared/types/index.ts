// Device types
export type DeviceType = 'iPhone' | 'iPad' | 'Mac' | 'AppleTV' | 'AppleWatch' | 'VisionPro';
export type EnrollmentStatus = 'pending' | 'enrolled' | 'unenrolled';
export type AssetStatus = 'in_use' | 'in_stock' | 'repairing' | 'retired' | 'lost';
export type CommandStatus = 'queued' | 'sent' | 'acknowledged' | 'error' | 'not_now';
export type DataScope = 'all' | 'department_and_children' | 'department' | 'self';

export interface Department {
  id: string;
  name: string;
  parentId?: string;
  sortOrder: number;
  createdAt: string;
  children?: Department[];
  parent?: { id: string; name: string };
  _count?: { users: number; children: number };
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  dataScope: DataScope;
  builtIn: boolean;
  createdAt: string;
  permissions?: Permission[];
  _count?: { users: number };
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  sortOrder: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  roleId: string;
  departmentId?: string;
  createdAt: string;
  role: { id: string; name: string };
  department?: { id: string; name: string };
}

export interface Device {
  id: string;
  udid: string;
  serialNumber: string;
  deviceType: DeviceType;
  model?: string;
  modelName?: string;
  osVersion?: string;
  buildVersion?: string;
  deviceName?: string;
  productName?: string;
  storageCapacity?: number;
  wifiMac?: string;
  bluetoothMac?: string;
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
  assignedToId?: string;
  departmentId?: string;
  location?: string;
  status: AssetStatus;
  notes?: string;
  createdAt: string;
  device?: Device;
  assignedUser?: { id: string; name: string; email: string };
  department?: { id: string; name: string };
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

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: string;
  read: boolean;
  createdAt: string;
}

// API response types
export interface PaginatedResponse {
  total: number;
  page: number;
  limit: number;
}

export interface DeviceListResponse extends PaginatedResponse {
  devices: Device[];
}

export interface AssetListResponse extends PaginatedResponse {
  assets: Asset[];
}

export interface UserListResponse extends PaginatedResponse {
  users: User[];
}

export interface DepartmentTreeResponse {
  departments: Department[];
}

export interface RoleListResponse extends PaginatedResponse {
  roles: Role[];
}

export interface NotificationListResponse extends PaginatedResponse {
  notifications: Notification[];
}
