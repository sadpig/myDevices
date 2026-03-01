# myDevices 系统全面升级实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 全面升级 myDevices MDM 系统 — 激活部门/角色权限、资产流程改造、通知系统、代码审查与 Bug 修复

**Architecture:** 后端 Fastify + Prisma + PostgreSQL + Redis + nodemailer，前端 Next.js 14 App Router + shadcn/ui + react-i18next。按模块顺序实施，每个模块包含 schema 变更、后端 API、前端页面。

**Tech Stack:** TypeScript, Fastify 5, Prisma 7, Next.js 14, shadcn/ui, nodemailer, i18next, Redis (ioredis)

---

## Task 1: 基础设施 — Notification 模型 + 邮件服务

**Files:**
- Modify: `backend/prisma/schema.prisma` — 添加 Notification 模型
- Create: `backend/src/services/mail.ts` — nodemailer 封装
- Create: `backend/src/services/notification.ts` — 通知服务
- Modify: `backend/package.json` — 添加 nodemailer 依赖
- Modify: `backend/src/app.ts` — BigInt 序列化 + 统一错误处理

**Step 1: 安装 nodemailer**

```bash
cd backend && npm install nodemailer && npm install -D @types/nodemailer
```

**Step 2: 添加 Notification 模型到 schema.prisma**

在 AuditLog 模型后添加：

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  title     String
  content   String
  type      String   // asset_assigned, profile_installed, system
  read      Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, read])
  @@map("notifications")
}
```

在 User 模型中添加：
```prisma
notifications Notification[]
```

**Step 3: 运行 migration**

```bash
cd backend && npx prisma migrate dev --name add_notifications
```

**Step 4: 创建 mail.ts**

```typescript
// backend/src/services/mail.ts
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to, subject, html,
    });
    return true;
  } catch (err) {
    console.error('Failed to send email:', err);
    return false;
  }
}

export function resetTransporter() {
  transporter = null;
}
```

**Step 5: 创建 notification.ts**

```typescript
// backend/src/services/notification.ts
import { PrismaClient } from '@prisma/client';
import { sendEmail } from './mail.js';

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  async create(userId: string, title: string, content: string, type: string) {
    return this.prisma.notification.create({
      data: { userId, title, content, type },
    });
  }

  async createAndEmail(userId: string, title: string, content: string, type: string) {
    const notification = await this.create(userId, title, content, type);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      await sendEmail(user.email, title, content);
    }
    return notification;
  }

  async list(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const where: any = { userId };
    if (unreadOnly) where.read = false;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { notifications, total, page, limit };
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }
}
```

**Step 6: 修改 app.ts — BigInt 序列化**

在 `buildApp()` 函数开头添加：

```typescript
// BigInt JSON 序列化
(BigInt.prototype as any).toJSON = function () { return Number(this); };
```

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add notification model, mail service, BigInt serialization"
```

---

## Task 2: 基础设施 — shared/types 同步 + 前端错误处理

**Files:**
- Modify: `shared/types/index.ts` — 全面同步 Prisma schema
- Modify: `frontend/src/lib/api.ts` — 统一错误 toast

**Step 1: 重写 shared/types/index.ts**

```typescript
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
export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
}

export interface DeviceListResponse extends PaginatedResponse<Device> {
  devices: Device[];
}

export interface AssetListResponse extends PaginatedResponse<Asset> {
  assets: Asset[];
}

export interface UserListResponse extends PaginatedResponse<User> {
  users: User[];
}

export interface DepartmentTreeResponse {
  departments: Department[];
}

export interface RoleListResponse extends PaginatedResponse<Role> {
  roles: Role[];
}

export interface NotificationListResponse extends PaginatedResponse<Notification> {
  notifications: Notification[];
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: sync shared types with prisma schema, add notification/department/role types"
```

---

## Task 3: 部门管理 — 后端 CRUD + 树形查询

**Files:**
- Create: `backend/src/modules/departments/service.ts`
- Create: `backend/src/modules/departments/routes.ts`
- Modify: `backend/src/app.ts` — 注册路由

**Step 1: 创建 departments/service.ts**

```typescript
// backend/src/modules/departments/service.ts
import { PrismaClient } from '@prisma/client';

export class DepartmentService {
  constructor(private prisma: PrismaClient) {}

  async getTree() {
    const all = await this.prisma.department.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { users: true, children: true } } },
    });
    const map = new Map(all.map(d => [d.id, { ...d, children: [] as any[] }]));
    const roots: any[] = [];
    for (const dept of map.values()) {
      if (dept.parentId && map.has(dept.parentId)) {
        map.get(dept.parentId)!.children.push(dept);
      } else {
        roots.push(dept);
      }
    }
    return roots;
  }

  async list(page = 1, limit = 50) {
    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { users: true, children: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.department.count(),
    ]);
    return { departments, total, page, limit };
  }

  async create(name: string, parentId?: string, sortOrder = 0) {
    return this.prisma.department.create({
      data: { name, parentId: parentId || null, sortOrder },
      include: { parent: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, data: { name?: string; parentId?: string | null; sortOrder?: number }) {
    if (data.parentId === id) throw new Error('Cannot set self as parent');
    return this.prisma.department.update({
      where: { id },
      data,
      include: { parent: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    const dept = await this.prisma.department.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { users: true, children: true } } },
    });
    if (dept._count.children > 0) throw new Error('Cannot delete department with children');
    if (dept._count.users > 0) throw new Error('Cannot delete department with users');
    return this.prisma.department.delete({ where: { id } });
  }
}
```

**Step 2: 创建 departments/routes.ts**

```typescript
// backend/src/modules/departments/routes.ts
import { FastifyPluginAsync } from 'fastify';
import { DepartmentService } from './service.js';
import { AuditService } from '../audit/service.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';

const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new DepartmentService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  fastify.get('/tree', { preHandler: [authenticate] }, async () => {
    return { departments: await service.getTree() };
  });

  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { page, limit } = request.query as { page?: string; limit?: string };
    return service.list(parseInt(page || '1'), parseInt(limit || '50'));
  });

  fastify.post('/', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const { name, parentId, sortOrder } = request.body as { name: string; parentId?: string; sortOrder?: number };
    if (!name?.trim()) return reply.status(400).send({ error: 'Name is required' });
    const dept = await service.create(name.trim(), parentId, sortOrder);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'department.create', 'department', dept.id, { name, parentId }, request.ip);
    return reply.status(201).send(dept);
  });

  fastify.put('/:id', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as { name?: string; parentId?: string | null; sortOrder?: number };
    try {
      const dept = await service.update(id, data);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'department.update', 'department', id, data, request.ip);
      return dept;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete('/:id', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await service.remove(id);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'department.delete', 'department', id, {}, request.ip);
      return { message: 'Department deleted' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};

export default departmentRoutes;
```

**Step 3: 注册路由到 app.ts**

在 `import profileRoutes` 后添加：
```typescript
import departmentRoutes from './modules/departments/routes.js';
```

在 `app.register(profileRoutes...)` 后添加：
```typescript
await app.register(departmentRoutes, { prefix: '/api/departments' });
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add department management backend (tree CRUD)"
```

---

## Task 4: 角色权限 — 后端 CRUD + 权限初始化

**Files:**
- Create: `backend/src/modules/roles/service.ts`
- Create: `backend/src/modules/roles/routes.ts`
- Modify: `backend/src/app.ts` — 注册路由
- Modify: `backend/prisma/seed.ts` — 初始化权限数据

**Step 1: 创建 roles/service.ts**

```typescript
// backend/src/modules/roles/service.ts
import { PrismaClient, DataScope } from '@prisma/client';

export class RoleService {
  constructor(private prisma: PrismaClient) {}

  async list() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getById(id: string) {
    return this.prisma.role.findUniqueOrThrow({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  }

  async create(data: { name: string; description?: string; dataScope?: DataScope; permissionIds?: string[] }) {
    return this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        dataScope: data.dataScope || 'self',
        permissions: data.permissionIds?.length
          ? { create: data.permissionIds.map(pid => ({ permissionId: pid })) }
          : undefined,
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async update(id: string, data: { name?: string; description?: string; dataScope?: DataScope; permissionIds?: string[] }) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    if (role.builtIn && data.name && data.name !== role.name) {
      throw new Error('Cannot rename built-in role');
    }
    if (data.permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      if (data.permissionIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: data.permissionIds.map(pid => ({ roleId: id, permissionId: pid })),
        });
      }
    }
    return this.prisma.role.update({
      where: { id },
      data: { name: data.name, description: data.description, dataScope: data.dataScope },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (role.builtIn) throw new Error('Cannot delete built-in role');
    if (role._count.users > 0) throw new Error('Cannot delete role with users');
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    return this.prisma.role.delete({ where: { id } });
  }

  async listPermissions() {
    const perms = await this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }] });
    const grouped: Record<string, typeof perms> = {};
    for (const p of perms) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return grouped;
  }

  async getRolePermissionCodes(roleId: string): Promise<string[]> {
    const rps = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: { select: { code: true } } },
    });
    return rps.map(rp => rp.permission.code);
  }
}
```

**Step 2: 创建 roles/routes.ts**

```typescript
// backend/src/modules/roles/routes.ts
import { FastifyPluginAsync } from 'fastify';
import { RoleService } from './service.js';
import { AuditService } from '../audit/service.js';
import { requireRole } from '../../middleware/authenticate.js';

const roleRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new RoleService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  fastify.get('/', { preHandler: [requireRole('super_admin')] }, async () => {
    return { roles: await service.list() };
  });

  fastify.get('/permissions', { preHandler: [requireRole('super_admin')] }, async () => {
    return { permissions: await service.listPermissions() };
  });

  fastify.post('/', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const data = request.body as { name: string; description?: string; dataScope?: any; permissionIds?: string[] };
    if (!data.name?.trim()) return reply.status(400).send({ error: 'Name is required' });
    const role = await service.create(data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'role.create', 'role', role.id, { name: data.name }, request.ip);
    return reply.status(201).send(role);
  });

  fastify.put('/:id', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as { name?: string; description?: string; dataScope?: any; permissionIds?: string[] };
    try {
      const role = await service.update(id, data);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'role.update', 'role', id, data, request.ip);
      return role;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete('/:id', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await service.remove(id);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'role.delete', 'role', id, {}, request.ip);
      return { message: 'Role deleted' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};

export default roleRoutes;
```

**Step 3: 注册路由到 app.ts**

```typescript
import roleRoutes from './modules/roles/routes.js';
// ...
await app.register(roleRoutes, { prefix: '/api/roles' });
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add role/permission management backend"
```

---

## Task 5: 角色权限 — 后端 CRUD + 权限中间件改造

**Files:**
- Create: `backend/src/modules/roles/service.ts`
- Create: `backend/src/modules/roles/routes.ts`
- Modify: `backend/src/middleware/authenticate.ts` — 添加 requirePermission()
- Modify: `backend/src/app.ts` — 注册路由
- Modify: `backend/prisma/seed.ts` — 初始化权限数据

**Step 1: 创建 roles/service.ts**

```typescript
// backend/src/modules/roles/service.ts
import { PrismaClient, DataScope } from '@prisma/client';

export class RoleService {
  constructor(private prisma: PrismaClient, private redis?: any) {}

  async list(page = 1, limit = 20) {
    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.role.count(),
    ]);
    // Flatten permissions
    const mapped = roles.map(r => ({
      ...r,
      permissions: r.permissions.map(rp => rp.permission),
    }));
    return { roles: mapped, total, page, limit };
  }

  async getById(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { id },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
    return { ...role, permissions: role.permissions.map(rp => rp.permission) };
  }

  async create(data: { name: string; description?: string; dataScope?: DataScope; permissionIds?: string[] }) {
    return this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        dataScope: data.dataScope || 'self',
        permissions: data.permissionIds?.length
          ? { create: data.permissionIds.map(pid => ({ permissionId: pid })) }
          : undefined,
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async update(id: string, data: { name?: string; description?: string; dataScope?: DataScope; permissionIds?: string[] }) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    if (role.builtIn && data.name && data.name !== role.name) {
      throw new Error('Cannot rename built-in role');
    }
    // Update permissions: delete all, re-create
    if (data.permissionIds) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.rolePermission.createMany({
        data: data.permissionIds.map(pid => ({ roleId: id, permissionId: pid })),
      });
      // Invalidate Redis cache
      if (this.redis) await this.redis.del(`role:${id}:perms`);
    }
    return this.prisma.role.update({
      where: { id },
      data: { name: data.name, description: data.description, dataScope: data.dataScope },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (role.builtIn) throw new Error('Cannot delete built-in role');
    if (role._count.users > 0) throw new Error('Role has associated users');
    return this.prisma.role.delete({ where: { id } });
  }

  async listPermissions() {
    const perms = await this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }] });
    // Group by module
    const grouped: Record<string, typeof perms> = {};
    for (const p of perms) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return grouped;
  }

  async getPermissionCodes(roleId: string): Promise<string[]> {
    // Check Redis cache first
    if (this.redis) {
      const cached = await this.redis.get(`role:${roleId}:perms`);
      if (cached) return JSON.parse(cached);
    }
    const rps = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: { select: { code: true } } },
    });
    const codes = rps.map(rp => rp.permission.code);
    if (this.redis) {
      await this.redis.set(`role:${roleId}:perms`, JSON.stringify(codes), 'EX', 300);
    }
    return codes;
  }
}
```

**Step 2: 创建 roles/routes.ts**

```typescript
// backend/src/modules/roles/routes.ts
import { FastifyPluginAsync } from 'fastify';
import { RoleService } from './service.js';
import { AuditService } from '../audit/service.js';
import { requireRole } from '../../middleware/authenticate.js';

const roleRoutes: FastifyPluginAsync = async (fastify) => {
  const roleService = new RoleService(fastify.prisma, fastify.redis);
  const auditService = new AuditService(fastify.prisma);

  fastify.get('/', { preHandler: [requireRole('super_admin')] }, async (request) => {
    const { page, limit } = request.query as { page?: string; limit?: string };
    return roleService.list(parseInt(page || '1'), parseInt(limit || '20'));
  });

  fastify.get('/permissions', { preHandler: [requireRole('super_admin')] }, async () => {
    return roleService.listPermissions();
  });

  fastify.get('/:id', { preHandler: [requireRole('super_admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    return roleService.getById(id);
  });

  fastify.post('/', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const data = request.body as { name: string; description?: string; dataScope?: string; permissionIds?: string[] };
    const role = await roleService.create(data as any);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'role.create', 'role', role.id, { name: data.name }, request.ip);
    return reply.status(201).send(role);
  });

  fastify.put('/:id', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    try {
      const role = await roleService.update(id, data);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'role.update', 'role', id, data, request.ip);
      return role;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete('/:id', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await roleService.remove(id);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'role.delete', 'role', id, {}, request.ip);
      return { message: 'Role deleted' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};

export default roleRoutes;
```

**Step 3: 修改 authenticate.ts — 添加 requirePermission**

在现有 `requireRole` 函数后添加：

```typescript
export function requirePermission(...codes: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const token = extractToken(request);
      if (token && await isTokenBlacklisted(request, token)) {
        return reply.status(401).send({ error: 'Token has been revoked' });
      }
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (codes.length === 0) return; // just authenticate
    const user = request.user as { id: string; roleId?: string; role?: string };
    // super_admin bypasses permission checks
    if (user.role === 'super_admin') return;
    // Check permissions via Redis cache or DB
    const roleId = user.roleId;
    if (!roleId) return reply.status(403).send({ error: 'Forbidden' });
    let permCodes: string[] = [];
    try {
      const cached = await request.server.redis.get(`role:${roleId}:perms`);
      if (cached) {
        permCodes = JSON.parse(cached);
      } else {
        const rps = await request.server.prisma.rolePermission.findMany({
          where: { roleId },
          include: { permission: { select: { code: true } } },
        });
        permCodes = rps.map((rp: any) => rp.permission.code);
        await request.server.redis.set(`role:${roleId}:perms`, JSON.stringify(permCodes), 'EX', 300);
      }
    } catch {
      return reply.status(500).send({ error: 'Permission check failed' });
    }
    const hasPermission = codes.some(c => permCodes.includes(c));
    if (!hasPermission) return reply.status(403).send({ error: 'Forbidden' });
  };
}
```

**Step 4: 注册路由到 app.ts**

```typescript
import roleRoutes from './modules/roles/routes.js';
// ...
await app.register(roleRoutes, { prefix: '/api/roles' });
```

**Step 5: seed.ts 添加权限初始化**

在 seed main() 函数中，创建角色之前添加权限数据：

```typescript
const PERMISSIONS = [
  { code: 'device.read', name: '查看设备', module: 'device', sortOrder: 1 },
  { code: 'device.update', name: '编辑设备', module: 'device', sortOrder: 2 },
  { code: 'device.delete', name: '删除设备', module: 'device', sortOrder: 3 },
  { code: 'asset.read', name: '查看资产', module: 'asset', sortOrder: 1 },
  { code: 'asset.create', name: '创建资产', module: 'asset', sortOrder: 2 },
  { code: 'asset.update', name: '编辑资产', module: 'asset', sortOrder: 3 },
  { code: 'asset.delete', name: '删除资产', module: 'asset', sortOrder: 4 },
  { code: 'profile.read', name: '查看配置', module: 'profile', sortOrder: 1 },
  { code: 'profile.create', name: '创建配置', module: 'profile', sortOrder: 2 },
  { code: 'profile.update', name: '编辑配置', module: 'profile', sortOrder: 3 },
  { code: 'profile.delete', name: '删除配置', module: 'profile', sortOrder: 4 },
  { code: 'user.read', name: '查看用户', module: 'user', sortOrder: 1 },
  { code: 'user.create', name: '创建用户', module: 'user', sortOrder: 2 },
  { code: 'user.update', name: '编辑用户', module: 'user', sortOrder: 3 },
  { code: 'user.delete', name: '删除用户', module: 'user', sortOrder: 4 },
  { code: 'department.read', name: '查看部门', module: 'department', sortOrder: 1 },
  { code: 'department.manage', name: '管理部门', module: 'department', sortOrder: 2 },
  { code: 'role.read', name: '查看角色', module: 'role', sortOrder: 1 },
  { code: 'role.manage', name: '管理角色', module: 'role', sortOrder: 2 },
  { code: 'audit.read', name: '查看审计日志', module: 'audit', sortOrder: 1 },
  { code: 'report.read', name: '查看报表', module: 'report', sortOrder: 1 },
  { code: 'settings.manage', name: '系统设置', module: 'settings', sortOrder: 1 },
  { code: 'notification.read', name: '查看通知', module: 'notification', sortOrder: 1 },
];

for (const p of PERMISSIONS) {
  await prisma.permission.upsert({
    where: { code: p.code },
    update: { name: p.name, module: p.module, sortOrder: p.sortOrder },
    create: p,
  });
}

const allPerms = await prisma.permission.findMany();
const allPermIds = allPerms.map(p => p.id);
```

然后修改角色创建，关联权限：

```typescript
// super_admin 角色获得所有权限
const superAdminRole = await prisma.role.upsert({
  where: { name: 'super_admin' },
  update: {},
  create: { name: 'super_admin', description: '超级管理员', dataScope: 'all', builtIn: true },
});
// 清除旧权限，重新关联
await prisma.rolePermission.deleteMany({ where: { roleId: superAdminRole.id } });
await prisma.rolePermission.createMany({
  data: allPermIds.map(pid => ({ roleId: superAdminRole.id, permissionId: pid })),
});

// device_admin 角色
const deviceAdminPerms = allPerms.filter(p =>
  ['device', 'asset', 'profile', 'audit', 'report', 'notification'].includes(p.module)
).map(p => p.id);
const deviceAdminRole = await prisma.role.upsert({
  where: { name: 'device_admin' },
  update: {},
  create: { name: 'device_admin', description: '设备管理员', dataScope: 'department_and_children', builtIn: true },
});
await prisma.rolePermission.deleteMany({ where: { roleId: deviceAdminRole.id } });
await prisma.rolePermission.createMany({
  data: deviceAdminPerms.map(pid => ({ roleId: deviceAdminRole.id, permissionId: pid })),
});

// readonly 角色
const readonlyPerms = allPerms.filter(p => p.code.endsWith('.read')).map(p => p.id);
const readonlyRole = await prisma.role.upsert({
  where: { name: 'readonly' },
  update: {},
  create: { name: 'readonly', description: '只读用户', dataScope: 'self', builtIn: true },
});
await prisma.rolePermission.deleteMany({ where: { roleId: readonlyRole.id } });
await prisma.rolePermission.createMany({
  data: readonlyPerms.map(pid => ({ roleId: readonlyRole.id, permissionId: pid })),
});
```

**Step 6: 修改 JWT payload 包含 roleId**

修改 `auth/routes.ts` login 路由，JWT sign 改为：

```typescript
const token = fastify.jwt.sign(
  { id: user.id, email: user.email, roleId: user.roleId, role: user.roleName },
  { expiresIn: '24h' }
);
```

修改 `auth/service.ts` login 方法返回 roleId 和 roleName：

```typescript
async login(email: string, password: string) {
  const user = await this.prisma.user.findUnique({
    where: { email },
    include: { role: { select: { id: true, name: true } } },
  });
  if (!user) throw new Error('Invalid credentials');
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid credentials');
  return {
    id: user.id, email: user.email, name: user.name,
    roleId: user.roleId, roleName: user.role.name,
    departmentId: user.departmentId,
  };
}
```

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add role/permission CRUD, requirePermission middleware, seed permissions"
```

---

## Task 7: 用户管理升级 — 后端增加 departmentId/roleId 支持

**Files:**
- Modify: `backend/src/modules/auth/service.ts` — createUser/updateUser/listUsers 增加关联
- Modify: `backend/src/modules/auth/routes.ts` — 更新参数

**Step 1: 修改 auth/service.ts**

login() 返回值增加 roleId：
```typescript
return { id: user.id, email: user.email, name: user.name, roleId: user.roleId, role: user.role };
```

createUser() 改为接受 roleId 和 departmentId：
```typescript
async createUser(email: string, name: string, password: string, roleId: string, departmentId?: string) {
  const existing = await this.prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already exists');
  const passwordHash = await bcrypt.hash(password, 12);
  return this.prisma.user.create({
    data: { email, name, passwordHash, roleId, departmentId: departmentId || null },
    select: {
      id: true, email: true, name: true, roleId: true, departmentId: true, createdAt: true,
      role: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });
}
```

updateUser() 增加 departmentId：
```typescript
async updateUser(id: string, data: { name?: string; roleId?: string; departmentId?: string | null }) {
  return this.prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, email: true, name: true, roleId: true, departmentId: true, createdAt: true,
      role: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });
}
```

listUsers() include role 和 department：
```typescript
async listUsers(page = 1, limit = 20, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
  const allowedSort = ['createdAt', 'name', 'email'];
  const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
  const [users, total] = await Promise.all([
    this.prisma.user.findMany({
      select: {
        id: true, email: true, name: true, roleId: true, departmentId: true, createdAt: true,
        role: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { [orderField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    this.prisma.user.count(),
  ]);
  return { users, total, page, limit };
}
```

getUserById() 同样 include：
```typescript
async getUserById(id: string) {
  return this.prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, roleId: true, departmentId: true, createdAt: true,
      role: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });
}
```

新增 resetPassword()：
```typescript
async resetPassword(userId: string) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let newPwd = '';
  for (let i = 0; i < 12; i++) newPwd += chars[Math.floor(Math.random() * chars.length)];
  const passwordHash = await bcrypt.hash(newPwd, 12);
  await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return newPwd;
}
```

**Step 2: 修改 auth/routes.ts**

register 路由 body 改为接受 roleId, departmentId：
```typescript
properties: {
  email: { type: 'string', format: 'email' },
  name: { type: 'string', minLength: 1, maxLength: 100 },
  password: { type: 'string', minLength: 6, maxLength: 100 },
  roleId: { type: 'string' },
  departmentId: { type: 'string' },
},
```

handler 改为：
```typescript
const { email, name, password, roleId, departmentId } = request.body as any;
const user = await authService.createUser(email, name, password, roleId, departmentId);
```

PUT /users/:id body schema 增加 departmentId：
```typescript
properties: {
  name: { type: 'string', minLength: 1, maxLength: 100 },
  roleId: { type: 'string' },
  departmentId: { type: ['string', 'null'] },
},
```

新增 POST /users/:id/reset-password：
```typescript
fastify.post('/users/:id/reset-password', { preHandler: [requireRole('super_admin')] }, async (request) => {
  const { id } = request.params as { id: string };
  const newPassword = await authService.resetPassword(id);
  const currentUser = request.user as { id: string };
  await auditService.log(currentUser.id, 'user.reset_password', 'user', id, {}, request.ip);
  return { password: newPassword };
});
```

login 路由 JWT sign 改为包含 roleId：
```typescript
const token = fastify.jwt.sign(
  { id: user.id, email: user.email, roleId: user.roleId },
  { expiresIn: '24h' }
);
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: upgrade user management with roleId, departmentId, resetPassword"
```

---

## Task 8: 资产管理升级 — Schema 迁移 + 通知触发

**Files:**
- Modify: `backend/prisma/schema.prisma` — Asset FK 变更
- Modify: `backend/src/modules/assets/service.ts` — FK 关联 + 通知
- Modify: `backend/src/modules/assets/routes.ts` — 注入 NotificationService

**Step 1: 修改 schema.prisma Asset 模型**

将 Asset 模型中的：
```prisma
assignedTo   String?     @map("assigned_to")
department   String?
```

替换为：
```prisma
assignedToId String?     @map("assigned_to_id")
departmentId String?     @map("department_id")
assignedUser User?       @relation("AssetAssignee", fields: [assignedToId], references: [id])
department   Department? @relation(fields: [departmentId], references: [id])
```

在 User 模型中添加：
```prisma
assignedAssets Asset[] @relation("AssetAssignee")
```

在 Department 模型中添加：
```prisma
assets Asset[]
```

**Step 2: 创建迁移**

```bash
cd backend && npx prisma migrate dev --name asset_fk_migration
```

注意：这是破坏性变更，旧的 assignedTo/department 文本数据会丢失。如果需要保留，先写一个迁移脚本按名称匹配。对于开发环境可以直接 migrate reset + seed。

**Step 3: 修改 assets/service.ts**

create() 改为接受 assignedToId, departmentId：
```typescript
async create(data: {
  deviceId: string; purchaseDate?: string; purchasePrice?: number;
  warrantyEnd?: string; assignedToId?: string; departmentId?: string;
  location?: string; status?: AssetStatus; notes?: string;
}) {
  return this.prisma.asset.create({
    data: {
      deviceId: data.deviceId,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      purchasePrice: data.purchasePrice,
      warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : undefined,
      assignedToId: data.assignedToId || null,
      departmentId: data.departmentId || null,
      location: data.location,
      status: data.status || 'in_stock',
      notes: data.notes,
    },
    include: {
      device: true,
      assignedUser: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true } },
    },
  });
}
```

list() include 改为：
```typescript
include: {
  device: { select: { serialNumber: true, deviceName: true, deviceType: true, modelName: true } },
  assignedUser: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
},
```

update() 同样更新 include 和字段名。

getById() include 改为：
```typescript
include: {
  device: true,
  assignedUser: { select: { id: true, name: true, email: true } },
  department: { select: { id: true, name: true } },
},
```

**Step 4: 修改 assets/routes.ts — 资产分配通知**

在 POST 和 PUT 路由中，当 assignedToId 有值时触发通知：

```typescript
import { NotificationService } from '../../services/notification.js';

// 在路由注册函数内
const notificationService = new NotificationService(fastify.prisma);

// POST handler 中，创建成功后：
if (asset.assignedToId) {
  const deviceName = asset.device?.deviceName || asset.device?.serialNumber || '';
  await notificationService.createAndEmail(
    asset.assignedToId,
    '资产分配通知',
    `设备 ${deviceName} 已分配给您`,
    'asset_assigned'
  );
}

// PUT handler 中，如果 assignedToId 变更：
if (data.assignedToId && data.assignedToId !== oldAsset.assignedToId) {
  const deviceName = updated.device?.deviceName || updated.device?.serialNumber || '';
  await notificationService.createAndEmail(
    data.assignedToId,
    '资产分配通知',
    `设备 ${deviceName} 已分配给您`,
    'asset_assigned'
  );
}
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: asset FK migration, notification on assignment"
```

---

## Task 9: 通知系统 — 后端 API

**Files:**
- Create: `backend/src/modules/notifications/routes.ts`
- Modify: `backend/src/app.ts` — 注册路由

**Step 1: 创建 notifications/routes.ts**

```typescript
// backend/src/modules/notifications/routes.ts
import { FastifyPluginAsync } from 'fastify';
import { NotificationService } from '../../services/notification.js';
import { authenticate } from '../../middleware/authenticate.js';

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  const notificationService = new NotificationService(fastify.prisma);

  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    const { page, limit, unreadOnly } = request.query as { page?: string; limit?: string; unreadOnly?: string };
    return notificationService.list(userId, parseInt(page || '1'), parseInt(limit || '20'), unreadOnly === 'true');
  });

  fastify.get('/unread-count', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    const count = await notificationService.unreadCount(userId);
    return { count };
  });

  fastify.put('/:id/read', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    const { id } = request.params as { id: string };
    await notificationService.markRead(id, userId);
    return { message: 'Marked as read' };
  });

  fastify.put('/read-all', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    await notificationService.markAllRead(userId);
    return { message: 'All marked as read' };
  });
};

export default notificationRoutes;
```

**Step 2: 注册路由到 app.ts**

```typescript
import notificationRoutes from './modules/notifications/routes.js';
// ...
await app.register(notificationRoutes, { prefix: '/api/notifications' });
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: notification API routes"
```

---

## Task 10: SMTP 配置 — 后端 API

**Files:**
- Modify: `backend/src/app.ts` — 添加 SMTP 设置端点

**Step 1: 在 app.ts 中添加 SMTP 配置端点**

在现有 APNs 端点后添加：

```typescript
import { resetTransporter } from './services/mail.js';

app.get('/api/settings/smtp', { preHandler: authenticate }, async () => {
  return {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT || '587',
    secure: process.env.SMTP_SECURE || 'false',
    user: process.env.SMTP_USER || '',
    from: process.env.SMTP_FROM || '',
    configured: !!process.env.SMTP_HOST,
  };
});

app.put('/api/settings/smtp', { preHandler: requireRole('super_admin') }, async (request) => {
  const { host, port, secure, user, pass, from } = request.body as Record<string, string>;
  const envPath = resolve(process.cwd(), '.env');
  let envContent = '';
  try { envContent = readFileSync(envPath, 'utf-8'); } catch { envContent = ''; }

  const updates: Record<string, string> = {};
  if (host !== undefined) updates.SMTP_HOST = host;
  if (port !== undefined) updates.SMTP_PORT = port;
  if (secure !== undefined) updates.SMTP_SECURE = secure;
  if (user !== undefined) updates.SMTP_USER = user;
  if (pass !== undefined) updates.SMTP_PASS = pass;
  if (from !== undefined) updates.SMTP_FROM = from;

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    process.env[key] = value;
  }

  writeFileSync(envPath, envContent.trim() + '\n');
  resetTransporter(); // Force re-create transporter with new settings
  return { message: 'SMTP settings updated' };
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: SMTP configuration API"
```

---

## Task 10: 通知系统 — 后端路由 + 前端铃铛

**Files:**
- Create: `backend/src/modules/notifications/routes.ts`
- Modify: `backend/src/app.ts` — 注册通知路由 + SMTP 设置路由
- Modify: `frontend/src/components/layout/header.tsx` — 通知铃铛
- Modify: `frontend/src/i18n/zh.json` — 通知相关翻译
- Modify: `frontend/src/i18n/en.json` — 通知相关翻译

**Step 1: 创建 notifications/routes.ts**

```typescript
// backend/src/modules/notifications/routes.ts
import { FastifyPluginAsync } from 'fastify';
import { NotificationService } from '../../services/notification.js';
import { authenticate } from '../../middleware/authenticate.js';

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  const notifService = new NotificationService(fastify.prisma);

  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    const { page, limit, unreadOnly } = request.query as { page?: string; limit?: string; unreadOnly?: string };
    return notifService.list(userId, parseInt(page || '1'), parseInt(limit || '20'), unreadOnly === 'true');
  });

  fastify.get('/unread-count', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    const count = await notifService.unreadCount(userId);
    return { count };
  });

  fastify.put('/:id/read', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    const { id } = request.params as { id: string };
    await notifService.markRead(id, userId);
    return { message: 'Marked as read' };
  });

  fastify.put('/read-all', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    await notifService.markAllRead(userId);
    return { message: 'All marked as read' };
  });
};

export default notificationRoutes;
```

**Step 2: 在 app.ts 注册路由**

```typescript
import notificationRoutes from './modules/notifications/routes.js';
// ...
await app.register(notificationRoutes, { prefix: '/api/notifications' });
```

同时更新 SMTP 设置端点（在现有 APNs 设置旁边）：

```typescript
app.get('/api/settings/smtp', { preHandler: requireRole('super_admin') }, async () => {
  return {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT || '587',
    user: process.env.SMTP_USER || '',
    from: process.env.SMTP_FROM || '',
    secure: process.env.SMTP_SECURE || 'false',
  };
});

app.put('/api/settings/smtp', { preHandler: requireRole('super_admin') }, async (request) => {
  const { host, port, user, pass, from, secure } = request.body as any;
  const envPath = resolve(process.cwd(), '.env');
  let envContent = '';
  try { envContent = readFileSync(envPath, 'utf-8'); } catch { envContent = ''; }

  const updates: Record<string, string> = {};
  if (host !== undefined) updates.SMTP_HOST = host;
  if (port !== undefined) updates.SMTP_PORT = port;
  if (user !== undefined) updates.SMTP_USER = user;
  if (pass !== undefined) updates.SMTP_PASS = pass;
  if (from !== undefined) updates.SMTP_FROM = from;
  if (secure !== undefined) updates.SMTP_SECURE = secure;

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    process.env[key] = value;
  }
  writeFileSync(envPath, envContent.trim() + '\n');

  // Reset transporter to pick up new config
  const { resetTransporter } = await import('./services/mail.js');
  resetTransporter();

  return { message: 'SMTP settings updated' };
});
```

**Step 3: 修改 header.tsx — 添加通知铃铛**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LogOut, Bell } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from './language-toggle';
import api from '@/lib/api';

interface HeaderProps {
  onLogout: () => void;
  userName?: string;
}

export function Header({ onLogout, userName }: HeaderProps) {
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    const fetchCount = () => {
      api.get('/api/notifications/unread-count').then(res => setUnreadCount(res.data.count)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const toggleNotifs = async () => {
    if (!showNotifs) {
      const res = await api.get('/api/notifications?limit=10&unreadOnly=false').catch(() => null);
      if (res) setNotifs(res.data.notifications || []);
    }
    setShowNotifs(!showNotifs);
  };

  const markAllRead = async () => {
    await api.put('/api/notifications/read-all').catch(() => {});
    setUnreadCount(0);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <header className="h-14 border-b border-border bg-card/50 glass-subtle flex items-center justify-between px-6 sticky top-0 z-10">
      <div />
      <div className="flex items-center gap-3">
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={toggleNotifs} className="relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          {showNotifs && (
            <div className="absolute right-0 top-10 w-80 bg-card border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between p-3 border-b">
                <span className="text-sm font-medium">{t('notifications.title')}</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                    {t('notifications.markAllRead')}
                  </button>
                )}
              </div>
              {notifs.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">{t('notifications.empty')}</div>
              ) : (
                notifs.map(n => (
                  <div key={n.id} className={`p-3 border-b text-sm ${n.read ? '' : 'bg-primary/5'}`}>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{n.content}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <LanguageToggle />
        <ThemeToggle />
        {userName && <span className="text-sm text-muted-foreground">{userName}</span>}
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          {t('common.logout')}
        </Button>
      </div>
    </header>
  );
}
```

**Step 4: 添加 i18n 翻译**

zh.json 添加：
```json
"notifications.title": "通知",
"notifications.markAllRead": "全部已读",
"notifications.empty": "暂无通知",
"notifications.assetAssigned": "资产分配通知",
```

en.json 添加：
```json
"notifications.title": "Notifications",
"notifications.markAllRead": "Mark all read",
"notifications.empty": "No notifications",
"notifications.assetAssigned": "Asset Assignment",
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: notification system with bell icon, SMTP config, polling"
```

---

## Task 11: 前端 — 设备管理优化

**Files:**
- Modify: `backend/src/modules/devices/service.ts` — UDID 搜索
- Modify: `frontend/src/app/(dashboard)/devices/page.tsx` — UDID 搜索提示
- Modify: `frontend/src/app/(dashboard)/devices/[id]/page.tsx` — BigInt 修复

**Step 1: 修改 devices/service.ts 搜索增加 UDID**

在 list() 的 where.OR 中添加：
```typescript
{ udid: { contains: filters.search, mode: 'insensitive' } },
```

**Step 2: 修改设备列表页搜索 placeholder**

更新 i18n：
```json
"devices.searchPlaceholder": "搜索设备名称、序列号、UDID..."
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: device UDID search, BigInt fix already in Task 1"
```

---

## Task 12: 前端 — 配置描述文件优化

**Files:**
- Modify: `frontend/src/app/(dashboard)/profiles/new/page.tsx` — payload 模板选择器

**Step 1: 添加 payload 模板**

在 new/page.tsx 中添加模板常量和选择器：

```typescript
const PAYLOAD_TEMPLATES: Record<string, { payloadType: string; payload: Record<string, any> }> = {
  wifi: {
    payloadType: 'com.apple.wifi.managed',
    payload: {
      SSID_STR: '', HIDDEN_NETWORK: false,
      EncryptionType: 'WPA2', Password: '',
      AutoJoin: true,
    },
  },
  vpn: {
    payloadType: 'com.apple.vpn.managed',
    payload: {
      VPNType: 'IKEv2', RemoteAddress: '',
      LocalIdentifier: '', RemoteIdentifier: '',
      AuthenticationMethod: 'Certificate',
    },
  },
  email: {
    payloadType: 'com.apple.mail.managed',
    payload: {
      EmailAccountType: 'EmailTypeIMAP',
      IncomingMailServerHostName: '', IncomingMailServerPortNumber: 993,
      IncomingMailServerUseSSL: true,
      OutgoingMailServerHostName: '', OutgoingMailServerPortNumber: 587,
    },
  },
  restrictions: {
    payloadType: 'com.apple.applicationaccess',
    payload: {
      allowCamera: true, allowScreenShot: true,
      allowAppInstallation: true, allowInAppPurchases: false,
      allowExplicitContent: false,
    },
  },
  passcode: {
    payloadType: 'com.apple.mobiledevice.passwordpolicy',
    payload: {
      allowSimple: false, forcePIN: true,
      maxPINAgeInDays: 90, minLength: 6,
      requireAlphanumeric: false,
    },
  },
};
```

在表单中添加模板选择按钮组，选择后自动填充 payloadType 和 payload。

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: profile payload templates for WiFi, VPN, Email, Restrictions, Passcode"
```

---

## Task 13: 前端 — Settings 页面全面改造

**Files:**
- Modify: `frontend/src/app/(dashboard)/settings/page.tsx` — 部门管理 tab + 角色管理 tab + 邮件配置 tab + 用户管理升级

**Step 1: 重写 settings/page.tsx**

Settings 页面改为 5 个 tab：
1. 用户管理 — 用户列表 + 创建/编辑/删除/重置密码（部门树选择器 + 角色下拉）
2. 部门管理 — 树形展示 + 增删改
3. 角色管理 — 角色列表 + 权限勾选矩阵
4. APNs 配置 — 现有功能
5. 邮件配置 — SMTP 设置 + 测试发送

由于此页面代码量大（约 600-800 行），建议拆分为子组件：
- `frontend/src/app/(dashboard)/settings/components/user-management.tsx`
- `frontend/src/app/(dashboard)/settings/components/department-management.tsx`
- `frontend/src/app/(dashboard)/settings/components/role-management.tsx`
- `frontend/src/app/(dashboard)/settings/components/apns-settings.tsx`
- `frontend/src/app/(dashboard)/settings/components/smtp-settings.tsx`

主 page.tsx 只负责 tab 切换和组件渲染。

**关键 UI 组件：**

部门树选择器（可复用）：
```typescript
// frontend/src/components/ui/department-tree-select.tsx
// 递归渲染部门树，支持选择、展开/折叠
// Props: departments: Department[], value: string, onChange: (id: string) => void
```

权限矩阵：
```typescript
// 按 module 分组显示 checkbox grid
// 行 = module（设备、资产、配置文件...）
// 列 = 操作（读取、创建、编辑、删除、管理）
```

**Step 2: 添加 i18n 翻译**

zh.json 添加：
```json
"settings.tabs.users": "用户管理",
"settings.tabs.departments": "部门管理",
"settings.tabs.roles": "角色管理",
"settings.tabs.apns": "APNs 配置",
"settings.tabs.smtp": "邮件配置",
"settings.department.name": "部门名称",
"settings.department.parent": "上级部门",
"settings.department.userCount": "用户数",
"settings.department.deleteConfirm": "确定要删除部门 \"{{name}}\" 吗？",
"settings.department.hasChildren": "该部门下有子部门，无法删除",
"settings.department.hasUsers": "该部门下有用户，无法删除",
"settings.role.name": "角色名称",
"settings.role.description": "描述",
"settings.role.dataScope": "数据范围",
"settings.role.permissions": "权限",
"settings.role.userCount": "用户数",
"settings.role.deleteConfirm": "确定要删除角色 \"{{name}}\" 吗？",
"settings.role.builtIn": "内置角色",
"settings.smtp.host": "SMTP 服务器",
"settings.smtp.port": "端口",
"settings.smtp.user": "用户名",
"settings.smtp.pass": "密码",
"settings.smtp.from": "发件人",
"settings.smtp.secure": "SSL/TLS",
"settings.smtp.test": "发送测试邮件",
"settings.smtp.testSuccess": "测试邮件已发送",
"settings.smtp.testFailed": "发送失败",
"settings.user.resetPassword": "重置密码",
"settings.user.resetConfirm": "确定要重置用户 \"{{name}}\" 的密码吗？",
"settings.user.newPassword": "新密码",
"settings.user.department": "部门",
"settings.user.role": "角色",
"settings.user.selectDepartment": "选择部门",
"settings.user.selectRole": "选择角色",
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: settings page with department tree, role permissions, SMTP config"
```

---

## Task 14: 前端 — 资产管理页面升级

**Files:**
- Modify: `frontend/src/app/(dashboard)/assets/new/page.tsx` — 部门树选择器 + 用户选择器
- Modify: `frontend/src/app/(dashboard)/assets/[id]/page.tsx` — FK 关联展示 + 编辑改造
- Modify: `frontend/src/app/(dashboard)/assets/page.tsx` — 列表显示关联信息

**Step 1: 修改 assets/new/page.tsx**

替换 assignedTo 文本输入为用户选择器（下拉，按部门筛选）：
```typescript
// 加载部门树和用户列表
const [departments, setDepartments] = useState<any[]>([]);
const [users, setUsers] = useState<any[]>([]);
const [selectedDeptId, setSelectedDeptId] = useState('');

useEffect(() => {
  api.get('/api/departments/tree').then(res => setDepartments(res.data)).catch(() => {});
  api.get('/api/auth/users?limit=100').then(res => setUsers(res.data.users || [])).catch(() => {});
}, []);

// 按选中部门筛选用户
const filteredUsers = selectedDeptId
  ? users.filter(u => u.departmentId === selectedDeptId)
  : users;
```

表单字段改为：
- 部门：树形下拉选择器 → 设置 form.departmentId
- 分配人：用户下拉（按部门筛选）→ 设置 form.assignedToId

**Step 2: 修改 assets/[id]/page.tsx**

详情页显示：
- 分配人：显示 `asset.assignedUser?.name` 而非纯文本
- 部门：显示 `asset.department?.name`
- 编辑 Dialog 同样使用部门树选择器 + 用户选择器

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: asset pages with department tree picker and user selector"
```

---

## Task 15: 审计日志增强 + 分页修复

**Files:**
- Modify: `backend/src/modules/audit/service.ts` — 日期范围筛选
- Modify: `frontend/src/app/(dashboard)/audit-logs/page.tsx` — 分页修复

**Step 1: 修改 audit/service.ts**

list() 增加 startDate/endDate 参数：
```typescript
if (filters?.startDate) {
  where.createdAt = { ...where.createdAt, gte: new Date(filters.startDate) };
}
if (filters?.endDate) {
  const end = new Date(filters.endDate);
  end.setHours(23, 59, 59, 999);
  where.createdAt = { ...where.createdAt, lte: end };
}
```

**Step 2: 修改审计日志页面分页**

将 `disabled={logs.length < 50}` 改为 `disabled={page * 50 >= total}`，与其他页面一致。

显示改为：`共 {total} 条 · 第 {page}/{Math.ceil(total/50)} 页`

**Step 3: Commit**

```bash
git add -A && git commit -m "fix: audit log date range filter, consistent pagination"
```

---

## Task 16: Seed 数据更新

**Files:**
- Modify: `backend/prisma/seed.ts` — 更新为使用 roleId, departmentId, 权限数据

**Step 1: 更新 seed.ts**

seed 需要：
1. 创建权限数据（device.read, device.update, ... 等所有权限）
2. 创建默认角色并关联权限（super_admin 全部权限，device_admin 设备/资产/配置文件权限，readonly 只读权限）
3. 创建部门树（总部 → 技术部/市场部/财务部，技术部 → 前端组/后端组）
4. 创建用户时使用 roleId 和 departmentId
5. 创建资产时使用 assignedToId 和 departmentId

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: update seed with permissions, department tree, role associations"
```

---

## Task 17: 全局代码审查 & Bug 修复

**检查清单：**

1. [ ] .env writeFileSync 无锁 — 对于开发阶段可接受，生产环境建议改为数据库存储
2. [ ] 所有前端页面硬编码中文已替换为 t() 调用（audit-logs 和 assets/new 已由 linter 更新）
3. [ ] constants.ts 中 ROLE_LABELS / ENROLLMENT_STATUS_LABELS / ASSET_STATUS_LABELS 已移除（改用 i18n）
4. [ ] 所有 API 错误响应格式统一为 { error: string }
5. [ ] 前端所有 `any` 类型尽量替换为 shared/types 中的类型
6. [ ] 检查 XSS：所有用户输入通过 React JSX 渲染（自动转义），无 dangerouslySetInnerHTML
7. [ ] 检查 SQL 注入：Prisma ORM 参数化查询，安全
8. [ ] 检查 CORS 配置：仅允许 FRONTEND_URL
9. [ ] 检查 JWT secret：生产环境强制要求 JWT_SECRET
10. [ ] 删除未使用的导入和变量

**Commit:**

```bash
git add -A && git commit -m "fix: code review fixes, security audit, cleanup"
```

---

## 执行顺序总结

| Task | 模块 | 依赖 |
|------|------|------|
| 1 | Notification 模型 + 邮件服务 + BigInt | 无 |
| 2 | shared/types 同步 | 无 |
| 3 | 部门管理后端 | Task 1 (migration) |
| 4 | 部门管理前端 | Task 3 |
| 5 | 角色权限后端 | Task 1 |
| 6 | 角色权限前端 | Task 5 |
| 7 | 用户管理升级后端 | Task 3, 5 |
| 8 | 资产管理升级后端 | Task 1, 3, 7 |
| 9 | 资产管理升级前端 | Task 8 |
| 10 | 通知系统 | Task 1 |
| 11 | 设备管理优化 | 无 |
| 12 | 配置描述文件优化 | 无 |
| 13 | Settings 页面全面改造 | Task 3-8, 10 |
| 14 | 资产管理页面升级 | Task 8, 13 |
| 15 | 审计日志增强 | 无 |
| 16 | Seed 数据更新 | Task 3, 5, 7, 8 |
| 17 | 全局代码审查 | 全部完成后 |

可并行的任务组：
- Group A (无依赖): Task 1, 2, 11, 12, 15
- Group B (依赖 Task 1): Task 3, 5, 10
- Group C (依赖 B): Task 4, 6, 7
- Group D (依赖 C): Task 8, 13
- Group E (依赖 D): Task 9, 14, 16
- Final: Task 17

## Task 13: 设备管理优化

**Files:**
- Modify: `backend/src/modules/devices/service.ts` — UDID 搜索
- Modify: `frontend/src/app/(dashboard)/devices/page.tsx` — 搜索提示更新
- Modify: `frontend/src/app/(dashboard)/devices/[id]/page.tsx` — BigInt 修复

**Step 1: 修改 devices/service.ts — 搜索增加 UDID**

在 list() 方法的 search OR 条件中添加 udid：
```typescript
if (filters?.search) {
  where.OR = [
    { deviceName: { contains: filters.search, mode: 'insensitive' } },
    { serialNumber: { contains: filters.search, mode: 'insensitive' } },
    { modelName: { contains: filters.search, mode: 'insensitive' } },
    { udid: { contains: filters.search, mode: 'insensitive' } },
  ];
}
```

**Step 2: 前端搜索提示更新**

devices/page.tsx 搜索框 placeholder 更新，在 i18n 文件中：
```json
"devices.searchPlaceholder": "搜索设备名称、序列号、UDID..."
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add UDID search for devices"
```

---

## Task 14: 配置描述文件优化 — Payload 模板

**Files:**
- Modify: `frontend/src/app/(dashboard)/profiles/new/page.tsx` — 模板选择器

**Step 1: 添加 payload 模板常量**

在 profiles/new/page.tsx 顶部添加：
```typescript
const PAYLOAD_TEMPLATES: Record<string, { payloadType: string; payload: Record<string, any> }> = {
  wifi: {
    payloadType: 'com.apple.wifi.managed',
    payload: {
      SSID_STR: '',
      EncryptionType: 'WPA2',
      AutoJoin: true,
      IsHotspot: false,
    },
  },
  vpn: {
    payloadType: 'com.apple.vpn.managed',
    payload: {
      VPNType: 'IKEv2',
      RemoteAddress: '',
      LocalIdentifier: '',
      RemoteIdentifier: '',
      AuthenticationMethod: 'Certificate',
    },
  },
  email: {
    payloadType: 'com.apple.mail.managed',
    payload: {
      EmailAccountType: 'EmailTypeIMAP',
      IncomingMailServerHostName: '',
      IncomingMailServerPortNumber: 993,
      IncomingMailServerUseSSL: true,
      OutgoingMailServerHostName: '',
      OutgoingMailServerPortNumber: 587,
      OutgoingMailServerUseSSL: true,
    },
  },
  restrictions: {
    payloadType: 'com.apple.applicationaccess',
    payload: {
      allowCamera: true,
      allowScreenShot: true,
      allowAppInstallation: true,
      allowAppRemoval: false,
      allowSafari: true,
      allowAirDrop: false,
    },
  },
  passcode: {
    payloadType: 'com.apple.mobiledevice.passwordpolicy',
    payload: {
      allowSimple: false,
      forcePIN: true,
      minLength: 6,
      maxInactivity: 5,
      maxPINAgeInDays: 90,
      requireAlphanumeric: false,
    },
  },
};
```

**Step 2: 在表单中添加模板选择器**

在 name 字段上方添加：
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium">{t('profiles.template')}</label>
  <select
    onChange={e => {
      const tpl = PAYLOAD_TEMPLATES[e.target.value];
      if (tpl) {
        setForm(f => ({
          ...f,
          payloadType: tpl.payloadType,
          payload: JSON.stringify(tpl.payload, null, 2),
        }));
      }
    }}
    className="w-full border rounded-md px-3 py-2 text-sm"
  >
    <option value="">{t('profiles.selectTemplate')}</option>
    <option value="wifi">WiFi</option>
    <option value="vpn">VPN</option>
    <option value="email">Email</option>
    <option value="restrictions">{t('profiles.restrictions')}</option>
    <option value="passcode">{t('profiles.passcode')}</option>
  </select>
</div>
```

**Step 3: i18n 添加翻译**

zh.json:
```json
"profiles.template": "配置模板",
"profiles.selectTemplate": "选择模板（可选）",
"profiles.restrictions": "访问限制",
"profiles.passcode": "密码策略"
```

en.json:
```json
"profiles.template": "Template",
"profiles.selectTemplate": "Select template (optional)",
"profiles.restrictions": "Restrictions",
"profiles.passcode": "Passcode Policy"
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add payload templates for profile creation"
```

---

## Task 15: 审计日志增强 — 分页修复

**Files:**
- Modify: `backend/src/modules/audit/service.ts` — 日期范围筛选
- Modify: `frontend/src/app/(dashboard)/audit-logs/page.tsx` — 分页修复

**Step 1: 修改 audit/service.ts**

确认 list() 方法支持 startDate/endDate 参数（检查现有实现，如果缺少则添加）：
```typescript
async list(page = 1, limit = 50, filters?: {
  action?: string; targetType?: string;
  startDate?: string; endDate?: string;
}, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
  const where: any = {};
  if (filters?.action) where.action = { contains: filters.action, mode: 'insensitive' };
  if (filters?.targetType) where.targetType = filters.targetType;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate + 'T23:59:59.999Z');
  }
  // ... rest of query
}
```

**Step 2: 修改 audit-logs/page.tsx — 分页显示总页数**

替换分页区域：
```tsx
const totalPages = Math.ceil(total / 50);

<div className="flex justify-between items-center">
  <span className="text-sm text-muted-foreground">
    {t('audit.pageInfo', { total, page, pages: totalPages })}
  </span>
  <div className="space-x-2">
    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
      {t('common.prev')}
    </Button>
    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
      {t('common.next')}
    </Button>
  </div>
</div>
```

更新 i18n：
```json
// zh.json
"audit.pageInfo": "共 {{total}} 条 · 第 {{page}}/{{pages}} 页"
// en.json
"audit.pageInfo": "{{total}} total · Page {{page}}/{{pages}}"
```

**Step 3: Commit**

```bash
git add -A && git commit -m "fix: audit log date range filter and pagination display"
```

---

## Task 16: i18n 补全 — 所有新增模块翻译

**Files:**
- Modify: `frontend/src/i18n/zh.json`
- Modify: `frontend/src/i18n/en.json`

**Step 1: 添加所有新模块翻译到 zh.json**

```json
"departments.title": "部门管理",
"departments.name": "部门名称",
"departments.parent": "上级部门",
"departments.none": "无（顶级部门）",
"departments.sortOrder": "排序",
"departments.userCount": "人数",
"departments.childCount": "子部门",
"departments.new": "新建部门",
"departments.edit": "编辑部门",
"departments.deleteConfirm": "确定要删除部门 \"{{name}}\" 吗？",
"departments.hasChildren": "该部门下有子部门，无法删除",
"departments.hasUsers": "该部门下有用户，无法删除",

"roles.title": "角色管理",
"roles.name": "角色名称",
"roles.description": "描述",
"roles.dataScope": "数据范围",
"roles.permissions": "权限",
"roles.userCount": "用户数",
"roles.builtIn": "内置",
"roles.new": "新建角色",
"roles.edit": "编辑角色",
"roles.deleteConfirm": "确定要删除角色 \"{{name}}\" 吗？",
"roles.cannotDeleteBuiltIn": "内置角色不可删除",
"roles.hasUsers": "该角色下有用户，无法删除",

"dataScope.all": "全部数据",
"dataScope.department_and_children": "本部门及子部门",
"dataScope.department": "仅本部门",
"dataScope.self": "仅本人",

"permissions.device": "设备管理",
"permissions.asset": "资产管理",
"permissions.profile": "配置文件",
"permissions.user": "用户管理",
"permissions.department": "部门管理",
"permissions.role": "角色管理",
"permissions.audit": "审计日志",
"permissions.report": "报表",
"permissions.settings": "系统设置",

"notifications.title": "通知",
"notifications.markAllRead": "全部已读",
"notifications.noNotifications": "暂无通知",
"notifications.viewAll": "查看全部",

"settings.tabs.users": "用户管理",
"settings.tabs.departments": "部门管理",
"settings.tabs.roles": "角色管理",
"settings.tabs.apns": "APNs 配置",
"settings.tabs.smtp": "邮件配置",
"settings.smtp.host": "SMTP 服务器",
"settings.smtp.port": "端口",
"settings.smtp.user": "用户名",
"settings.smtp.pass": "密码",
"settings.smtp.from": "发件人",
"settings.smtp.secure": "SSL/TLS",
"settings.smtp.test": "发送测试邮件",
"settings.smtp.saved": "SMTP 配置已保存",
"settings.resetPassword": "重置密码",
"settings.resetPasswordConfirm": "确定要重置用户 \"{{name}}\" 的密码吗？",
"settings.newPassword": "新密码为：{{password}}，请妥善保管",
"settings.selectDepartment": "选择部门",
"settings.selectRole": "选择角色"
```

**Step 2: 添加对应 en.json**

```json
"departments.title": "Departments",
"departments.name": "Department Name",
"departments.parent": "Parent Department",
"departments.none": "None (Top Level)",
"departments.sortOrder": "Sort Order",
"departments.userCount": "Users",
"departments.childCount": "Sub-departments",
"departments.new": "New Department",
"departments.edit": "Edit Department",
"departments.deleteConfirm": "Are you sure you want to delete department \"{{name}}\"?",
"departments.hasChildren": "Cannot delete: has sub-departments",
"departments.hasUsers": "Cannot delete: has users",

"roles.title": "Roles",
"roles.name": "Role Name",
"roles.description": "Description",
"roles.dataScope": "Data Scope",
"roles.permissions": "Permissions",
"roles.userCount": "Users",
"roles.builtIn": "Built-in",
"roles.new": "New Role",
"roles.edit": "Edit Role",
"roles.deleteConfirm": "Are you sure you want to delete role \"{{name}}\"?",
"roles.cannotDeleteBuiltIn": "Cannot delete built-in role",
"roles.hasUsers": "Cannot delete: role has users",

"dataScope.all": "All Data",
"dataScope.department_and_children": "Department & Children",
"dataScope.department": "Department Only",
"dataScope.self": "Self Only",

"permissions.device": "Devices",
"permissions.asset": "Assets",
"permissions.profile": "Profiles",
"permissions.user": "Users",
"permissions.department": "Departments",
"permissions.role": "Roles",
"permissions.audit": "Audit Logs",
"permissions.report": "Reports",
"permissions.settings": "Settings",

"notifications.title": "Notifications",
"notifications.markAllRead": "Mark All Read",
"notifications.noNotifications": "No notifications",
"notifications.viewAll": "View All",

"settings.tabs.users": "Users",
"settings.tabs.departments": "Departments",
"settings.tabs.roles": "Roles",
"settings.tabs.apns": "APNs Config",
"settings.tabs.smtp": "Email Config",
"settings.smtp.host": "SMTP Server",
"settings.smtp.port": "Port",
"settings.smtp.user": "Username",
"settings.smtp.pass": "Password",
"settings.smtp.from": "From Address",
"settings.smtp.secure": "SSL/TLS",
"settings.smtp.test": "Send Test Email",
"settings.smtp.saved": "SMTP settings saved",
"settings.resetPassword": "Reset Password",
"settings.resetPasswordConfirm": "Reset password for user \"{{name}}\"?",
"settings.newPassword": "New password: {{password}}. Please save it securely.",
"settings.selectDepartment": "Select Department",
"settings.selectRole": "Select Role"
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add i18n translations for departments, roles, notifications, smtp"
```

---

## Task 17: Seed 数据更新

**Files:**
- Modify: `backend/prisma/seed.ts` — 更新权限初始化 + 部门树 + 用户关联

**Step 1: 更新 seed.ts**

在现有 seed 逻辑中，确保：

1. 创建权限数据（如果不存在）：
```typescript
const permissionData = [
  { code: 'device.read', name: '查看设备', module: 'device', sortOrder: 1 },
  { code: 'device.update', name: '编辑设备', module: 'device', sortOrder: 2 },
  { code: 'device.delete', name: '删除设备', module: 'device', sortOrder: 3 },
  { code: 'asset.read', name: '查看资产', module: 'asset', sortOrder: 1 },
  { code: 'asset.create', name: '创建资产', module: 'asset', sortOrder: 2 },
  { code: 'asset.update', name: '编辑资产', module: 'asset', sortOrder: 3 },
  { code: 'asset.delete', name: '删除资产', module: 'asset', sortOrder: 4 },
  { code: 'profile.read', name: '查看配置', module: 'profile', sortOrder: 1 },
  { code: 'profile.create', name: '创建配置', module: 'profile', sortOrder: 2 },
  { code: 'profile.update', name: '编辑配置', module: 'profile', sortOrder: 3 },
  { code: 'profile.delete', name: '删除配置', module: 'profile', sortOrder: 4 },
  { code: 'user.read', name: '查看用户', module: 'user', sortOrder: 1 },
  { code: 'user.create', name: '创建用户', module: 'user', sortOrder: 2 },
  { code: 'user.update', name: '编辑用户', module: 'user', sortOrder: 3 },
  { code: 'user.delete', name: '删除用户', module: 'user', sortOrder: 4 },
  { code: 'department.read', name: '查看部门', module: 'department', sortOrder: 1 },
  { code: 'department.manage', name: '管理部门', module: 'department', sortOrder: 2 },
  { code: 'role.read', name: '查看角色', module: 'role', sortOrder: 1 },
  { code: 'role.manage', name: '管理角色', module: 'role', sortOrder: 2 },
  { code: 'audit.read', name: '查看审计', module: 'audit', sortOrder: 1 },
  { code: 'report.read', name: '查看报表', module: 'report', sortOrder: 1 },
  { code: 'settings.manage', name: '系统设置', module: 'settings', sortOrder: 1 },
];

for (const p of permissionData) {
  await prisma.permission.upsert({
    where: { code: p.code },
    update: {},
    create: p,
  });
}
```

2. 为 super_admin 角色分配所有权限：
```typescript
const allPerms = await prisma.permission.findMany();
const superAdminRole = await prisma.role.findFirst({ where: { name: 'super_admin' } });
if (superAdminRole) {
  await prisma.rolePermission.deleteMany({ where: { roleId: superAdminRole.id } });
  await prisma.rolePermission.createMany({
    data: allPerms.map(p => ({ roleId: superAdminRole.id, permissionId: p.id })),
  });
}
```

3. 创建部门树种子数据：
```typescript
const hq = await prisma.department.upsert({
  where: { id: 'dept-hq' }, update: {},
  create: { id: 'dept-hq', name: '总部', sortOrder: 1 },
});
const techDept = await prisma.department.upsert({
  where: { id: 'dept-tech' }, update: {},
  create: { id: 'dept-tech', name: '技术部', parentId: hq.id, sortOrder: 1 },
});
await prisma.department.upsert({
  where: { id: 'dept-frontend' }, update: {},
  create: { id: 'dept-frontend', name: '前端组', parentId: techDept.id, sortOrder: 1 },
});
await prisma.department.upsert({
  where: { id: 'dept-backend' }, update: {},
  create: { id: 'dept-backend', name: '后端组', parentId: techDept.id, sortOrder: 2 },
});
await prisma.department.upsert({
  where: { id: 'dept-market' }, update: {},
  create: { id: 'dept-market', name: '市场部', parentId: hq.id, sortOrder: 2 },
});
await prisma.department.upsert({
  where: { id: 'dept-finance' }, update: {},
  create: { id: 'dept-finance', name: '财务部', parentId: hq.id, sortOrder: 3 },
});
```

4. 更新用户创建，关联 roleId 和 departmentId（替代旧的 role 字符串）

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: update seed with permissions, department tree, user associations"
```

---

## Task 18: 全局代码审查 & Bug 修复

**Files:**
- 全项目扫描

**已知 Bug 清单：**

1. **BigInt 序列化** — Task 1 已修复（app.ts 全局 toJSON）
2. **.env writeFileSync 无锁** — 低优先级，单实例部署可接受，添加注释说明
3. **分页不一致** — Task 15 已修复审计日志，检查其他页面
4. **JWT role 硬编码** — Task 7 已改为 roleId
5. **constants.ts 中 ROLE_LABELS/ENROLLMENT_STATUS_LABELS/ASSET_STATUS_LABELS 已被 i18n 替代** — 检查是否还有引用，如无则删除
6. **settings/page.tsx 硬编码角色选项** — Task 11 已改为从 API 读取
7. **assets/new/page.tsx 的 assignedTo/department 仍是文本输入** — Task 9 已改为选择器

**审查要点：**

- [ ] 所有 API 调用都有错误处理
- [ ] 所有用户输入都有验证（前后端）
- [ ] 无 XSS 风险（React 默认转义，检查 dangerouslySetInnerHTML）
- [ ] 无 SQL 注入（Prisma 参数化查询，已安全）
- [ ] 所有页面使用 i18n t() 而非硬编码中文
- [ ] 所有列表页分页逻辑一致
- [ ] 删除 constants.ts 中已被 i18n 替代的常量（保留 DEVICE_ICONS, ASSET_STATUS_VARIANT, DEVICE_TYPES）

**Step 1: 清理 constants.ts**

删除 ENROLLMENT_STATUS_LABELS, ASSET_STATUS_LABELS, ROLE_LABELS（已被 i18n 替代）。
检查所有引用这些常量的文件并替换为 t() 调用。

**Step 2: 检查所有页面 i18n 覆盖**

确保以下页面都使用 useTranslation：
- dashboard/page.tsx
- devices/page.tsx, devices/[id]/page.tsx
- assets/page.tsx, assets/[id]/page.tsx, assets/new/page.tsx
- profiles/page.tsx, profiles/[id]/page.tsx, profiles/new/page.tsx
- audit-logs/page.tsx
- reports/page.tsx
- settings/page.tsx
- login/page.tsx

**Step 3: Final commit**

```bash
git add -A && git commit -m "chore: code review cleanup, remove deprecated constants, ensure i18n coverage"
```

---

## 执行总结

| Task | 模块 | 主要变更 |
|------|------|---------|
| 1 | 基础设施 | Notification 模型 + mail service + BigInt fix |
| 2 | 基础设施 | shared/types 同步 |
| 3 | 部门管理 | 后端 CRUD + 树形查询 |
| 4 | 部门管理 | 前端 settings tab |
| 5 | 角色权限 | 后端 CRUD + 权限中间件 |
| 6 | 角色权限 | 前端 settings tab + 权限矩阵 |
| 7 | 用户管理 | 后端 roleId/departmentId + resetPassword |
| 8 | 资产管理 | Schema FK 迁移 + 通知触发 |
| 9 | 资产管理 | 前端部门树/用户选择器 |
| 10 | 通知系统 | 后端路由 + 前端铃铛 + SMTP 配置 |
| 11 | Settings | 前端完整重写（5 tabs） |
| 12 | Settings | 部门管理 + 角色管理 tab |
| 13 | 设备管理 | UDID 搜索 |
| 14 | 配置文件 | Payload 模板 |
| 15 | 审计日志 | 分页修复 + 日期筛选 |
| 16 | i18n | 所有新模块翻译 |
| 17 | Seed | 权限 + 部门树 + 用户关联 |
| 18 | 代码审查 | Bug 修复 + 清理 |

## Task 17: Seed 数据更新 — 权限 + 部门树

**Files:**
- Modify: `backend/prisma/seed.ts` — 初始化权限、部门、角色关联

**Step 1: 在 seed.ts main() 函数中，用户创建之前，添加权限和部门初始化**

```typescript
// === Permissions ===
const permissionData = [
  { code: 'device.read', name: '查看设备', module: 'device', sortOrder: 1 },
  { code: 'device.update', name: '编辑设备', module: 'device', sortOrder: 2 },
  { code: 'device.delete', name: '删除设备', module: 'device', sortOrder: 3 },
  { code: 'asset.read', name: '查看资产', module: 'asset', sortOrder: 1 },
  { code: 'asset.create', name: '创建资产', module: 'asset', sortOrder: 2 },
  { code: 'asset.update', name: '编辑资产', module: 'asset', sortOrder: 3 },
  { code: 'asset.delete', name: '删除资产', module: 'asset', sortOrder: 4 },
  { code: 'profile.read', name: '查看配置', module: 'profile', sortOrder: 1 },
  { code: 'profile.create', name: '创建配置', module: 'profile', sortOrder: 2 },
  { code: 'profile.update', name: '编辑配置', module: 'profile', sortOrder: 3 },
  { code: 'profile.delete', name: '删除配置', module: 'profile', sortOrder: 4 },
  { code: 'user.read', name: '查看用户', module: 'user', sortOrder: 1 },
  { code: 'user.create', name: '创建用户', module: 'user', sortOrder: 2 },
  { code: 'user.update', name: '编辑用户', module: 'user', sortOrder: 3 },
  { code: 'user.delete', name: '删除用户', module: 'user', sortOrder: 4 },
  { code: 'department.read', name: '查看部门', module: 'department', sortOrder: 1 },
  { code: 'department.manage', name: '管理部门', module: 'department', sortOrder: 2 },
  { code: 'role.read', name: '查看角色', module: 'role', sortOrder: 1 },
  { code: 'role.manage', name: '管理角色', module: 'role', sortOrder: 2 },
  { code: 'audit.read', name: '查看审计日志', module: 'audit', sortOrder: 1 },
  { code: 'report.read', name: '查看报表', module: 'report', sortOrder: 1 },
  { code: 'settings.manage', name: '系统设置', module: 'settings', sortOrder: 1 },
];

const permissions = [];
for (const p of permissionData) {
  const perm = await prisma.permission.upsert({
    where: { code: p.code },
    update: { name: p.name, module: p.module, sortOrder: p.sortOrder },
    create: p,
  });
  permissions.push(perm);
}
console.log(`Permissions: ${permissions.length} created/updated`);

// === Roles ===
const superAdminRole = await prisma.role.upsert({
  where: { name: 'super_admin' },
  update: {},
  create: { name: 'super_admin', description: '超级管理员 - 全部权限', dataScope: 'all', builtIn: true },
});
const deviceAdminRole = await prisma.role.upsert({
  where: { name: 'device_admin' },
  update: {},
  create: { name: 'device_admin', description: '设备管理员 - 设备和资产管理', dataScope: 'department_and_children', builtIn: true },
});
const readonlyRole = await prisma.role.upsert({
  where: { name: 'readonly' },
  update: {},
  create: { name: 'readonly', description: '只读用户 - 仅查看', dataScope: 'self', builtIn: true },
});

// Assign all permissions to super_admin
for (const perm of permissions) {
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
    update: {},
    create: { roleId: superAdminRole.id, permissionId: perm.id },
  });
}

// device_admin permissions
const deviceAdminPerms = permissions.filter(p =>
  ['device.read', 'device.update', 'asset.read', 'asset.create', 'asset.update',
   'profile.read', 'audit.read', 'report.read'].includes(p.code)
);
for (const perm of deviceAdminPerms) {
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: deviceAdminRole.id, permissionId: perm.id } },
    update: {},
    create: { roleId: deviceAdminRole.id, permissionId: perm.id },
  });
}

// readonly permissions
const readonlyPerms = permissions.filter(p => p.code.endsWith('.read'));
for (const perm of readonlyPerms) {
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: readonlyRole.id, permissionId: perm.id } },
    update: {},
    create: { roleId: readonlyRole.id, permissionId: perm.id },
  });
}

// === Departments ===
const hq = await prisma.department.upsert({
  where: { id: 'dept-hq' },
  update: {},
  create: { id: 'dept-hq', name: '总部', sortOrder: 1 },
});
const techDept = await prisma.department.upsert({
  where: { id: 'dept-tech' },
  update: {},
  create: { id: 'dept-tech', name: '技术部', parentId: hq.id, sortOrder: 1 },
});
const frontendTeam = await prisma.department.upsert({
  where: { id: 'dept-frontend' },
  update: {},
  create: { id: 'dept-frontend', name: '前端组', parentId: techDept.id, sortOrder: 1 },
});
const backendTeam = await prisma.department.upsert({
  where: { id: 'dept-backend' },
  update: {},
  create: { id: 'dept-backend', name: '后端组', parentId: techDept.id, sortOrder: 2 },
});
const marketDept = await prisma.department.upsert({
  where: { id: 'dept-market' },
  update: {},
  create: { id: 'dept-market', name: '市场部', parentId: hq.id, sortOrder: 2 },
});
const financeDept = await prisma.department.upsert({
  where: { id: 'dept-finance' },
  update: {},
  create: { id: 'dept-finance', name: '财务部', parentId: hq.id, sortOrder: 3 },
});

console.log('Departments: 6 created');
```

**Step 2: 修改用户创建部分，使用 roleId 和 departmentId**

```typescript
const admin = await prisma.user.upsert({
  where: { email: 'admin@mydevices.local' },
  update: {},
  create: {
    email: 'admin@mydevices.local',
    name: '系统管理员',
    passwordHash: hashSync('admin123', 12),
    roleId: superAdminRole.id,
    departmentId: hq.id,
  },
});

const deviceAdmin = await prisma.user.upsert({
  where: { email: 'deviceadmin@mydevices.local' },
  update: {},
  create: {
    email: 'deviceadmin@mydevices.local',
    name: '设备管理员',
    passwordHash: hashSync('admin123', 12),
    roleId: deviceAdminRole.id,
    departmentId: techDept.id,
  },
});

const viewer = await prisma.user.upsert({
  where: { email: 'viewer@mydevices.local' },
  update: {},
  create: {
    email: 'viewer@mydevices.local',
    name: '只读用户',
    passwordHash: hashSync('admin123', 12),
    roleId: readonlyRole.id,
    departmentId: frontendTeam.id,
  },
});
```

**Step 3: 修改资产创建部分，使用 assignedToId 和 departmentId**

将资产创建中的 `assignedTo: randomItem(NAMES)` 和 `department: randomItem(departments)` 替换为：
```typescript
const deptIds = [techDept.id, frontendTeam.id, backendTeam.id, marketDept.id, financeDept.id];
const userIds = [admin.id, deviceAdmin.id, viewer.id];

// 在资产创建循环中：
assignedToId: Math.random() > 0.3 ? randomItem(userIds) : null,
departmentId: randomItem(deptIds),
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: update seed with permissions, departments, role associations"
```

---

## Task 18: 全局代码审查 & Bug 修复

**Files:**
- Multiple files across backend and frontend

**Step 1: .env 写入安全性**

在 app.ts 中，将 .env 写入操作提取为工具函数，添加简单的文件锁：

```typescript
// backend/src/utils/env-writer.ts
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

let writing = false;

export async function updateEnvFile(updates: Record<string, string>) {
  // Simple mutex - wait if another write is in progress
  while (writing) await new Promise(r => setTimeout(r, 50));
  writing = true;
  try {
    const envPath = resolve(process.cwd(), '.env');
    let envContent = '';
    try { envContent = readFileSync(envPath, 'utf-8'); } catch { envContent = ''; }

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
      process.env[key] = value;
    }
    writeFileSync(envPath, envContent.trim() + '\n');
  } finally {
    writing = false;
  }
}
```

然后在 app.ts 中 APNs 和 SMTP 设置端点都使用 `updateEnvFile()`。

**Step 2: 分页一致性检查**

确保所有列表页的分页逻辑统一：
- 使用 `page >= totalPages` 禁用下一页（而非 `logs.length < limit`）
- 显示 "第 X/Y 页" 格式

检查文件：
- devices/page.tsx ✓ (已使用 total)
- assets/page.tsx ✓
- profiles/page.tsx — 检查并修复
- audit-logs/page.tsx — 已在 Task 15 修复
- settings/page.tsx — 用户列表检查

**Step 3: 安全检查**

- 确认所有用户输入在后端经过 Fastify schema 验证
- 确认前端不使用 dangerouslySetInnerHTML（除非有 DOMPurify）
- 确认 SQL 注入防护（Prisma ORM 已处理）
- 确认 XSS 防护（React 默认转义）

**Step 4: 删除残留的硬编码角色引用**

搜索前端所有 `super_admin`、`device_admin`、`readonly` 硬编码字符串，替换为从 API 获取的角色数据。

constants.ts 中删除 `ROLE_LABELS`（已在之前的 linter 变更中移除）和 `ENROLLMENT_STATUS_LABELS`、`ASSET_STATUS_LABELS`（改用 i18n）。

**Step 5: Commit**

```bash
git add -A && git commit -m "fix: env write safety, pagination consistency, security review"
```

---

## 执行总结

| Task | 模块 | 预计文件数 |
|------|------|-----------|
| 1 | Notification 模型 + 邮件服务 | 4 |
| 2 | shared/types 同步 | 1 |
| 3 | 部门管理后端 | 3 |
| 4 | 部门管理前端 | 2 |
| 5 | 角色权限后端 | 4 |
| 6 | 角色权限前端 | 2 |
| 7 | 用户管理升级后端 | 2 |
| 8 | 资产管理升级 Schema + 后端 | 3 |
| 9 | 资产管理升级前端 | 2 |
| 10 | 通知系统后端 + 前端铃铛 | 4 |
| 11 | 设置页 — 部门管理 tab | 1 |
| 12 | 设置页 — 角色管理 + 用户升级 + SMTP tab | 1 |
| 13 | 设备管理优化 | 2 |
| 14 | 配置描述文件优化 | 1 |
| 15 | 审计日志增强 | 2 |
| 16 | i18n 补全 | 2 |
| 17 | Seed 数据更新 | 1 |
| 18 | 全局代码审查 & Bug 修复 | 5+ |
