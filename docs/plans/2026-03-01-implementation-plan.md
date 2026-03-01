# myDevices 全面审计与优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复全部 15 个 Bug，清理依赖，扩充功能，优化性能，安全加固

**Architecture:** Fastify + Next.js 16 + Prisma 7 + PostgreSQL + Redis 单体应用，npm workspaces monorepo

**Tech Stack:** TypeScript, Fastify 5, Next.js 16, React 19, Prisma 7, Redis (ioredis), shadcn/ui, TanStack Table, react-hook-form + zod, plist

---

## Phase 1: 后端 Bug 修复 + 基础设施

### Task 1: 安全加固 — .gitignore + 环境变量检查

**Files:**
- Modify: `.gitignore`
- Modify: `backend/src/app.ts:11`
- Modify: `backend/src/plugins/prisma.ts:13`
- Modify: `.env.example`

**Step 1: 更新 .gitignore**

在 `.gitignore` 末尾添加:
```
*.p8
*.pem
```

**Step 2: 修改 app.ts — 移除不安全的 JWT secret fallback**

将 `backend/src/app.ts:11` 的:
```ts
await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' });
```
改为:
```ts
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}
await app.register(jwt, { secret: jwtSecret || 'dev-secret' });
```

**Step 3: 修改 prisma.ts — 移除不安全的数据库 URL fallback**

将 `backend/src/plugins/prisma.ts:12-13` 的:
```ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || 'postgresql://mydevices:mydevices_dev@localhost:5432/mydevices',
});
```
改为:
```ts
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL environment variable is required in production');
}
const adapter = new PrismaPg({
  connectionString: dbUrl || 'postgresql://mydevices:mydevices_dev@localhost:5432/mydevices',
});
```

**Step 4: 更新 .env.example — 添加 APNS_TOPIC**

在 `.env.example` 添加:
```
APNS_TOPIC=com.example.mdm.pushcert
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**Step 5: Commit**
```bash
git add .gitignore backend/src/app.ts backend/src/plugins/prisma.ts .env.example
git commit -m "fix: add security hardening for env vars and gitignore"
```

---

### Task 2: 修复 seed.ts bcrypt cost 不一致 (B7)

**Files:**
- Modify: `backend/prisma/seed.ts:19`

**Step 1: 修改 bcrypt cost**

将 `backend/prisma/seed.ts:19` 的:
```ts
passwordHash: hashSync('admin123', 10),
```
改为:
```ts
passwordHash: hashSync('admin123', 12),
```

**Step 2: Commit**
```bash
git add backend/prisma/seed.ts
git commit -m "fix: unify bcrypt cost to 12 in seed.ts"
```

---

### Task 3: 安装 plist 包 + 注册 content-type parser (B2)

**Files:**
- Modify: `backend/package.json` (安装 plist + @types/plist)
- Modify: `backend/src/app.ts`

**Step 1: 安装 plist**
```bash
cd backend && npm install plist && npm install -D @types/plist
```

**Step 2: 在 app.ts 注册 plist content-type parser**

在 `backend/src/app.ts` 的 `import` 区域添加:
```ts
import plist from 'plist';
```

在 `await app.register(redisPlugin);` 之后添加:
```ts
// Register plist content-type parser for MDM endpoints
app.addContentTypeParser(
  ['application/x-apple-aspen-mdm-checkin', 'application/x-apple-aspen-mdm'],
  { parseAs: 'string' },
  (_req, body, done) => {
    try {
      done(null, plist.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  }
);
```

**Step 3: Commit**
```bash
git add backend/package.json backend/src/app.ts
git commit -m "fix: add plist parser for MDM content types"
```

---

### Task 4: 修复 APNs topic 错误 (B1)

**Files:**
- Modify: `backend/src/modules/mdm/apns.ts`
- Modify: `backend/src/modules/mdm/routes.ts:8-13`

**Step 1: 修改 APNsConfig 接口和 sendPush 方法**

在 `backend/src/modules/mdm/apns.ts:5-10` 的 APNsConfig 接口中添加 topic:
```ts
interface APNsConfig {
  keyId: string;
  teamId: string;
  keyPath: string;
  topic: string;
  production: boolean;
}
```

将 `backend/src/modules/mdm/apns.ts:87` 的:
```ts
'apns-topic': pushMagic,
```
改为:
```ts
'apns-topic': this.config.topic,
```

**Step 2: 修改 routes.ts 传入 topic**

将 `backend/src/modules/mdm/routes.ts:8-13` 的:
```ts
const apnsService = new APNsService({
  keyId: process.env.APNS_KEY_ID || '',
  teamId: process.env.APNS_TEAM_ID || '',
  keyPath: process.env.APNS_KEY_PATH || '',
  production: process.env.NODE_ENV === 'production',
});
```
改为:
```ts
const apnsService = new APNsService({
  keyId: process.env.APNS_KEY_ID || '',
  teamId: process.env.APNS_TEAM_ID || '',
  keyPath: process.env.APNS_KEY_PATH || '',
  topic: process.env.APNS_TOPIC || '',
  production: process.env.NODE_ENV === 'production',
});
```

同时更新 `isConfigured()`:
```ts
isConfigured(): boolean {
  return !!(this.config.keyId && this.config.teamId && this.config.keyPath && this.config.topic);
}
```

**Step 3: Commit**
```bash
git add backend/src/modules/mdm/apns.ts backend/src/modules/mdm/routes.ts
git commit -m "fix: use correct APNs topic from config instead of pushMagic"
```

---

### Task 5: 修复设备命令路由绕过 APNs (B3)

**Files:**
- Modify: `backend/src/modules/devices/routes.ts:42-55`

**Step 1: 引入 CommandService 和 APNsService**

在 `backend/src/modules/devices/routes.ts` 顶部添加 import:
```ts
import { CommandService } from '../mdm/commands.js';
import { APNsService } from '../mdm/apns.js';
```

在 `const deviceService = new DeviceService(fastify.prisma);` 之后添加:
```ts
const apnsService = new APNsService({
  keyId: process.env.APNS_KEY_ID || '',
  teamId: process.env.APNS_TEAM_ID || '',
  keyPath: process.env.APNS_KEY_PATH || '',
  topic: process.env.APNS_TOPIC || '',
  production: process.env.NODE_ENV === 'production',
});
const commandService = new CommandService(fastify.prisma, apnsService);
```

**Step 2: 替换直接写 DB 的命令路由**

将 `backend/src/modules/devices/routes.ts:42-55` 的:
```ts
fastify.post('/:id/commands', async (request) => {
  const { id } = request.params as { id: string };
  const { commandType, payload } = request.body as { commandType: string; payload?: any };
  const command = await fastify.prisma.mDMCommand.create({
    data: {
      deviceId: id,
      commandType,
      payload: payload || {},
      status: 'queued',
      requestId: crypto.randomUUID(),
    },
  });
  return command;
});
```
改为:
```ts
fastify.post('/:id/commands', async (request) => {
  const { id } = request.params as { id: string };
  const { commandType, payload } = request.body as { commandType: string; payload?: any };
  return commandService.queueCommand(id, commandType, payload || {});
});
```

**Step 3: Commit**
```bash
git add backend/src/modules/devices/routes.ts
git commit -m "fix: use CommandService for device commands to trigger APNs push"
```

---

### Task 6: 修复 MDM connect 状态映射 (B4)

**Files:**
- Modify: `backend/src/modules/mdm/routes.ts:45-47`

**Step 1: 修正状态映射逻辑**

将 `backend/src/modules/mdm/routes.ts:45-47` 的:
```ts
const status = body.Status === 'Acknowledged' ? 'acknowledged' :
               body.Status === 'Error' ? 'error' :
               body.Status === 'NotNow' ? 'not_now' : 'acknowledged';
```
改为:
```ts
const statusMap: Record<string, string> = {
  'Acknowledged': 'acknowledged',
  'Error': 'error',
  'NotNow': 'not_now',
  'CommandFormatError': 'error',
};
const status = (statusMap[body.Status] || 'error') as import('@prisma/client').CommandStatus;
```

**Step 2: Commit**
```bash
git add backend/src/modules/mdm/routes.ts
git commit -m "fix: correct MDM command status mapping for NotNow and unknown statuses"
```

---

### Task 7: 实现 Token 黑名单 — 修复登出无效 (B5)

**Files:**
- Modify: `backend/src/middleware/authenticate.ts`
- Modify: `backend/src/modules/auth/routes.ts:23-25`

**Step 1: 修改 authenticate 中间件 — 检查 Redis 黑名单**

将 `backend/src/middleware/authenticate.ts` 完整替换为:
```ts
import { FastifyRequest, FastifyReply } from 'fastify';

async function isTokenBlacklisted(request: FastifyRequest, token: string): Promise<boolean> {
  try {
    const result = await request.server.redis.get(`bl:${token}`);
    return result !== null;
  } catch {
    return false;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const token = extractToken(request);
    if (token && await isTokenBlacklisted(request, token)) {
      return reply.status(401).send({ error: 'Token has been revoked' });
    }
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export function requireRole(...roles: string[]) {
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
    const user = request.user as { role: string };
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  };
}
```

**Step 2: 修改 logout 路由 — 将 token 加入黑名单**

将 `backend/src/modules/auth/routes.ts:23-25` 的:
```ts
fastify.post('/logout', async () => {
  return { message: 'Logged out' };
});
```
改为:
```ts
fastify.post('/logout', { preHandler: [authenticate] }, async (request) => {
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    // 黑名单 TTL 24h，与 JWT 过期时间一致
    await fastify.redis.set(`bl:${token}`, '1', 'EX', 86400);
  }
  return { message: 'Logged out' };
});
```

**Step 3: Commit**
```bash
git add backend/src/middleware/authenticate.ts backend/src/modules/auth/routes.ts
git commit -m "feat: implement token blacklist via Redis for proper logout"
```

---

### Task 8: 添加数据库索引 (O1)

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: 添加索引**

在 `backend/prisma/schema.prisma` 的 `MDMCommand` model 中（`@@map("mdm_commands")` 之前）添加:
```prisma
@@index([deviceId, status])
```

在 `Device` model 中（`@@map("devices")` 之前）添加:
```prisma
@@index([enrollmentStatus])
@@index([deviceType])
```

**Step 2: 生成迁移**
```bash
cd backend && npx prisma migrate dev --name add_indexes
```

**Step 3: Commit**
```bash
git add backend/prisma/
git commit -m "perf: add database indexes for common query patterns"
```

---

### Task 9: 移除 bullmq + 注册 Swagger (依赖清理 + F7)

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/app.ts`

**Step 1: 移除 bullmq**
```bash
cd backend && npm uninstall bullmq
```

**Step 2: 在 app.ts 注册 swagger**

在 `backend/src/app.ts` import 区域添加:
```ts
import swagger from '@fastify/swagger';
```

在 `await app.register(redisPlugin);` 之后（plist parser 之前）添加:
```ts
await app.register(swagger, {
  openapi: {
    info: { title: 'myDevices API', version: '1.0.0', description: 'Apple 设备管理系统 API' },
    servers: [{ url: `http://localhost:${process.env.PORT || 3001}` }],
  },
});
```

**Step 3: Commit**
```bash
git add backend/package.json backend/src/app.ts
git commit -m "chore: remove unused bullmq, register swagger for API docs"
```

---

### Task 10: 定义共享类型 (B13)

**Files:**
- Modify: `shared/types/index.ts`
- Create: `shared/package.json`

**Step 1: 创建 shared/package.json**

```json
{
  "name": "shared",
  "version": "1.0.0",
  "private": true,
  "main": "types/index.ts",
  "types": "types/index.ts"
}
```

**Step 2: 填充 shared/types/index.ts**

```ts
// === Enums ===
export type DeviceType = 'iPhone' | 'iPad' | 'Mac' | 'AppleTV' | 'AppleWatch' | 'VisionPro';
export type EnrollmentStatus = 'pending' | 'enrolled' | 'unenrolled';
export type AssetStatus = 'in_use' | 'in_stock' | 'repairing' | 'retired' | 'lost';
export type UserRole = 'super_admin' | 'device_admin' | 'readonly';
export type CommandStatus = 'queued' | 'sent' | 'acknowledged' | 'error' | 'not_now';

// === API Response Types ===
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

// === Paginated Response ===
export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  [key: string]: T[] | number;
}

// === Auth ===
export interface LoginResponse {
  token: string;
  user: User;
}
```

**Step 3: Commit**
```bash
git add shared/
git commit -m "feat: add shared type definitions for frontend and backend"
```


### Task 11: 审计日志接入所有关键路由 (B14 + F3)

**Files:**
- Modify: `backend/src/modules/auth/routes.ts`
- Modify: `backend/src/modules/devices/routes.ts`
- Modify: `backend/src/modules/assets/routes.ts`
- Modify: `backend/src/modules/profiles/routes.ts`

**Step 1: 在 auth/routes.ts 接入审计日志**

在 import 区域添加:
```ts
import { AuditService } from '../audit/service.js';
```

在 `const authService = new AuthService(fastify.prisma);` 之后添加:
```ts
const auditService = new AuditService(fastify.prisma);
```

在 login 路由的 `return { token, user };` 之前添加:
```ts
await auditService.log(user.id, 'user.login', 'user', user.id, {}, request.ip);
```

在 logout 路由的 `return { message: 'Logged out' };` 之前添加:
```ts
const { id } = request.user as { id: string };
await auditService.log(id, 'user.logout', 'user', id, {}, request.ip);
```

在 register 路由的 `return reply.status(201).send(user);` 之前添加:
```ts
const currentUser = request.user as { id: string };
await auditService.log(currentUser.id, 'user.create', 'user', user.id, { email, role }, request.ip);
```

在 delete 路由的 `return { message: 'User deleted' };` 之前添加:
```ts
await auditService.log(currentUser.id, 'user.delete', 'user', id, {}, request.ip);
```

在 change-password 路由的 `return { message: 'Password changed' };` 之前添加:
```ts
await auditService.log(id, 'user.change_password', 'user', id, {}, request.ip);
```

**Step 2: 在 devices/routes.ts 接入审计日志**

在 import 区域添加:
```ts
import { AuditService } from '../audit/service.js';
```

在 service 初始化后添加:
```ts
const auditService = new AuditService(fastify.prisma);
```

在 PUT /:id 路由中，`return` 之前添加:
```ts
const user = request.user as { id: string };
await auditService.log(user.id, 'device.update', 'device', id, data, request.ip);
```

在 DELETE /:id 路由中，`return` 之前添加:
```ts
const user = request.user as { id: string };
await auditService.log(user.id, 'device.delete', 'device', id, {}, request.ip);
```

在 POST /:id/commands 路由中，`return` 之前添加:
```ts
const user = request.user as { id: string };
await auditService.log(user.id, 'device.command', 'device', id, { commandType }, request.ip);
```

**Step 3: 在 assets/routes.ts 接入审计日志**

同样模式 — import AuditService，在 POST / PUT 路由中记录:
```ts
import { AuditService } from '../audit/service.js';
// 初始化
const auditService = new AuditService(fastify.prisma);

// POST / 中:
const user = request.user as { id: string };
await auditService.log(user.id, 'asset.create', 'asset', asset.id, data, request.ip);

// PUT /:id 中:
const user = request.user as { id: string };
await auditService.log(user.id, 'asset.update', 'asset', id, data, request.ip);
```

**Step 4: 在 profiles/routes.ts 接入审计日志**

同样模式:
```ts
import { AuditService } from '../audit/service.js';
const auditService = new AuditService(fastify.prisma);

// POST / 中:
const user = request.user as { id: string };
await auditService.log(user.id, 'profile.create', 'profile', profile.id, { name: data.name }, request.ip);

// PUT /:id 中:
const user = request.user as { id: string };
await auditService.log(user.id, 'profile.update', 'profile', id, data, request.ip);

// POST /:id/install 中:
const user = request.user as { id: string };
await auditService.log(user.id, 'profile.install', 'profile', id, { deviceId }, request.ip);
```

**Step 5: Commit**
```bash
git add backend/src/modules/
git commit -m "feat: integrate audit logging into all critical routes"
```

---

### Task 12: 添加缺失的 CRUD 端点 (F4)

**Files:**
- Modify: `backend/src/modules/assets/routes.ts`
- Modify: `backend/src/modules/assets/service.ts`
- Modify: `backend/src/modules/profiles/routes.ts`
- Modify: `backend/src/modules/profiles/service.ts`

**Step 1: 添加 AssetService.remove()**

在 `backend/src/modules/assets/service.ts` 的 `stats()` 方法之前添加:
```ts
async remove(id: string) {
  return this.prisma.asset.delete({ where: { id } });
}
```

**Step 2: 添加 DELETE /api/assets/:id 路由**

在 `backend/src/modules/assets/routes.ts` 的 PUT 路由之后添加:
```ts
fastify.delete('/:id', async (request) => {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string };
  await assetService.remove(id);
  await auditService.log(user.id, 'asset.delete', 'asset', id, {}, request.ip);
  return { message: 'Asset deleted' };
});
```

**Step 3: 添加 ProfileService.remove() 和 removeFromDevice()**

在 `backend/src/modules/profiles/service.ts` 的 `installOnDevice()` 方法之后添加:
```ts
async remove(id: string) {
  return this.prisma.profile.delete({ where: { id } });
}

async removeFromDevice(profileId: string, deviceId: string) {
  return this.prisma.deviceProfile.delete({
    where: { deviceId_profileId: { deviceId, profileId } },
  });
}
```

**Step 4: 添加 DELETE 路由**

在 `backend/src/modules/profiles/routes.ts` 的 POST /:id/install 路由之后添加:
```ts
fastify.delete('/:id', async (request) => {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string };
  await profileService.remove(id);
  await auditService.log(user.id, 'profile.delete', 'profile', id, {}, request.ip);
  return { message: 'Profile deleted' };
});

fastify.delete('/:id/devices/:deviceId', async (request) => {
  const { id, deviceId } = request.params as { id: string; deviceId: string };
  const user = request.user as { id: string };
  await profileService.removeFromDevice(id, deviceId);
  await auditService.log(user.id, 'profile.uninstall', 'profile', id, { deviceId }, request.ip);
  return { message: 'Profile removed from device' };
});
```

**Step 5: Commit**
```bash
git add backend/src/modules/assets/ backend/src/modules/profiles/
git commit -m "feat: add DELETE endpoints for assets and profiles"
```

---

### Task 13: 添加 MDM enrollment profile 端点 (B15 + F1)

**Files:**
- Create: `backend/src/modules/mdm/enrollment.ts`
- Modify: `backend/src/modules/mdm/routes.ts`

**Step 1: 创建 enrollment.ts**

创建 `backend/src/modules/mdm/enrollment.ts`:
```ts
import plist from 'plist';
import crypto from 'node:crypto';

interface EnrollmentConfig {
  serverUrl: string;
  topic: string;
  identityName: string;
}

export function generateEnrollmentProfile(config: EnrollmentConfig): string {
  const profile = {
    PayloadContent: [
      {
        PayloadType: 'com.apple.mdm',
        PayloadVersion: 1,
        PayloadIdentifier: 'com.mydevices.mdm',
        PayloadUUID: crypto.randomUUID(),
        PayloadDisplayName: 'MDM Profile',
        PayloadDescription: 'Allows this device to be managed',
        ServerURL: `${config.serverUrl}/mdm/connect`,
        CheckInURL: `${config.serverUrl}/mdm/checkin`,
        Topic: config.topic,
        AccessRights: 8191,
        CheckOutWhenRemoved: true,
        ServerCapabilities: ['com.apple.mdm.per-user-connections'],
      },
    ],
    PayloadDisplayName: 'myDevices MDM',
    PayloadDescription: '设备管理注册配置',
    PayloadIdentifier: 'com.mydevices.enrollment',
    PayloadOrganization: 'myDevices',
    PayloadType: 'Configuration',
    PayloadUUID: crypto.randomUUID(),
    PayloadVersion: 1,
    PayloadRemovalDisallowed: false,
  };

  return plist.build(profile);
}
```

**Step 2: 在 mdm/routes.ts 添加 enrollment 端点**

在 import 区域添加:
```ts
import { generateEnrollmentProfile } from './enrollment.js';
```

在 `fastify.put('/checkin', ...)` 之前添加:
```ts
// MDM Enrollment profile download
fastify.get('/enroll', async (request, reply) => {
  const serverUrl = process.env.MDM_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`;
  const topic = process.env.APNS_TOPIC || '';
  if (!topic) {
    return reply.status(500).send({ error: 'APNS_TOPIC not configured' });
  }
  const profileXml = generateEnrollmentProfile({
    serverUrl,
    topic,
    identityName: 'myDevices MDM',
  });
  reply.header('Content-Type', 'application/x-apple-aspen-config');
  reply.header('Content-Disposition', 'attachment; filename="enroll.mobileconfig"');
  return reply.send(profileXml);
});
```

**Step 3: Commit**
```bash
git add backend/src/modules/mdm/
git commit -m "feat: add MDM enrollment profile generation endpoint"
```

---

### Task 14: 报表查询优化 + Redis 缓存 (O2)

**Files:**
- Modify: `backend/src/modules/reports/service.ts`
- Modify: `backend/src/modules/reports/routes.ts`

**Step 1: 修改 reports/routes.ts — 注入 Redis**

将 `backend/src/modules/reports/routes.ts` 完整替换为:
```ts
import { FastifyPluginAsync } from 'fastify';
import { ReportService } from './service.js';
import { authenticate } from '../../middleware/authenticate.js';

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  const reportService = new ReportService(fastify.prisma, fastify.redis);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/devices', async () => reportService.deviceStats());
  fastify.get('/assets', async () => reportService.assetStats());
  fastify.get('/compliance', async () => reportService.compliance());

  fastify.get('/devices/csv', async (request, reply) => {
    const data = await reportService.deviceStats();
    const csv = reportService.deviceStatsToCsv(data);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="device-report.csv"');
    return reply.send('\uFEFF' + csv);
  });

  fastify.get('/assets/csv', async (request, reply) => {
    const data = await reportService.assetStats();
    const csv = reportService.assetStatsToCsv(data);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="asset-report.csv"');
    return reply.send('\uFEFF' + csv);
  });
};

export default reportRoutes;
```

**Step 2: 修改 reports/service.ts — 添加 Redis 缓存 + CSV 导出**

将 `backend/src/modules/reports/service.ts` 完整替换为:
```ts
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export class ReportService {
  constructor(private prisma: PrismaClient, private redis: Redis) {}

  private async cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch {}
    const result = await fn();
    try {
      await this.redis.set(key, JSON.stringify(result), 'EX', ttl);
    } catch {}
    return result;
  }

  async deviceStats() {
    return this.cached('report:devices', 60, async () => {
      const [byType, byStatus, byOS, total] = await Promise.all([
        this.prisma.device.groupBy({ by: ['deviceType'], _count: true }),
        this.prisma.device.groupBy({ by: ['enrollmentStatus'], _count: true }),
        this.prisma.device.groupBy({ by: ['osVersion'], _count: true, orderBy: { _count: { osVersion: 'desc' } }, take: 10 }),
        this.prisma.device.count(),
      ]);
      return { byType, byStatus, byOS, total };
    });
  }

  async assetStats() {
    return this.cached('report:assets', 60, async () => {
      const [byStatus, byDepartment, total] = await Promise.all([
        this.prisma.asset.groupBy({ by: ['status'], _count: true }),
        this.prisma.asset.groupBy({ by: ['department'], _count: true, orderBy: { _count: { department: 'desc' } }, take: 10 }),
        this.prisma.asset.count(),
      ]);
      return { byStatus, byDepartment, total };
    });
  }

  async compliance() {
    return this.cached('report:compliance', 60, async () => {
      const [totalDevices, enrolled, supervised, withAsset] = await Promise.all([
        this.prisma.device.count(),
        this.prisma.device.count({ where: { enrollmentStatus: 'enrolled' } }),
        this.prisma.device.count({ where: { supervised: true } }),
        this.prisma.asset.count(),
      ]);
      return {
        totalDevices, enrolled,
        enrollmentRate: totalDevices > 0 ? (enrolled / totalDevices * 100).toFixed(1) : '0',
        supervised,
        supervisionRate: totalDevices > 0 ? (supervised / totalDevices * 100).toFixed(1) : '0',
        withAsset,
        assetCoverage: totalDevices > 0 ? (withAsset / totalDevices * 100).toFixed(1) : '0',
      };
    });
  }

  deviceStatsToCsv(data: any): string {
    let csv = '设备统计报表\n\n';
    csv += '设备类型,数量\n';
    data.byType.forEach((r: any) => { csv += `${r.deviceType},${r._count}\n`; });
    csv += '\n注册状态,数量\n';
    data.byStatus.forEach((r: any) => { csv += `${r.enrollmentStatus},${r._count}\n`; });
    csv += `\n总计,${data.total}\n`;
    return csv;
  }

  assetStatsToCsv(data: any): string {
    let csv = '资产统计报表\n\n';
    csv += '资产状态,数量\n';
    data.byStatus.forEach((r: any) => { csv += `${r.status},${r._count}\n`; });
    csv += '\n部门,数量\n';
    data.byDepartment.forEach((r: any) => { csv += `${r.department || "未分配"},${r._count}\n`; });
    csv += `\n总计,${data.total}\n`;
    return csv;
  }
}
```

**Step 3: Commit**
```bash
git add backend/src/modules/reports/
git commit -m "feat: add Redis caching for reports + CSV export endpoints"
```

---

## Phase 3: 前端修复与优化

### Task 15: 修复 401 硬跳转 (B11) + 认证逻辑统一 (B9)

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/hooks/use-auth.ts`
- Modify: `frontend/src/app/(dashboard)/layout.tsx`

**Step 1: 修改 api.ts — 用事件替代硬跳转**

将 `frontend/src/lib/api.ts` 完整替换为:
```ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    return Promise.reject(err);
  }
);

export default api;
```

**Step 2: 修改 use-auth.ts — 监听 auth:logout 事件 + 调用后端 logout**

将 `frontend/src/hooks/use-auth.ts` 完整替换为:
```ts
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.post('/api/auth/logout').catch(() => {});
    }
    localStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/api/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    router.push('/dashboard');
  }, [router]);

  return { user, loading, login, logout };
}
```

**Step 3: 修改 dashboard layout — 复用 useAuth hook**

将 `frontend/src/app/(dashboard)/layout.tsx` 完整替换为:
```tsx
'use client';
import { useAuth } from '@/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header onLogout={logout} userName={user.name} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

**Step 4: Commit**
```bash
git add frontend/src/lib/api.ts frontend/src/hooks/use-auth.ts frontend/src/app/\(dashboard\)/layout.tsx
git commit -m "fix: unify auth logic, replace hard redirect with event-based logout"
```

---

### Task 16: 修复设置页用户列表 (B8) + 添加用户删除功能

**Files:**
- Modify: `frontend/src/app/(dashboard)/settings/page.tsx`

**Step 1: 修复 loadUsers 调用 + 添加删除和用户列表**

将 `frontend/src/app/(dashboard)/settings/page.tsx` 中的 `loadUsers` 函数:
```ts
const loadUsers = () => {
  api.get('/api/auth/me').then(res => {
    setUsers([res.data]);
  }).catch(() => {});
};
```
改为:
```ts
const loadUsers = () => {
  api.get('/api/auth/users').then(res => {
    setUsers(res.data.users || []);
  }).catch(() => {
    // 非 super_admin 回退到只显示自己
    api.get('/api/auth/me').then(res => {
      setUsers([res.data]);
    }).catch(() => {});
  });
};
```

在 `handleCreateUser` 函数的 `setMessage('用户创建成功');` 之后添加:
```ts
loadUsers();
```

在 `SettingsPage` 组件中，`</form>` 之后、`</CardContent>` 之前添加用户列表和删除功能:
```tsx
{/* 用户列表 */}
<div className="mt-6">
  <h3 className="text-sm font-medium mb-3">现有用户</h3>
  <table className="w-full text-sm">
    <thead className="border-b bg-gray-50">
      <tr>
        <th className="p-2 text-left">姓名</th>
        <th className="p-2 text-left">邮箱</th>
        <th className="p-2 text-left">角色</th>
        <th className="p-2 text-left">操作</th>
      </tr>
    </thead>
    <tbody>
      {users.map((u: any) => (
        <tr key={u.id} className="border-b">
          <td className="p-2">{u.name}</td>
          <td className="p-2">{u.email}</td>
          <td className="p-2"><Badge>{roleLabels[u.role] || u.role}</Badge></td>
          <td className="p-2">
            <Button variant="ghost" size="sm" className="text-red-500"
              onClick={async () => {
                if (!confirm(`确定删除用户 ${u.name}？`)) return;
                try {
                  await api.delete(`/api/auth/users/${u.id}`);
                  loadUsers();
                } catch { setMessage('删除失败'); }
              }}>删除</Button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Step 2: Commit**
```bash
git add frontend/src/app/\(dashboard\)/settings/page.tsx
git commit -m "fix: settings page loads user list from /api/auth/users + add delete"
```

---

### Task 17: 搜索防抖 (B10) + 分页修复 (B12)

**Files:**
- Create: `frontend/src/hooks/use-debounce.ts`
- Modify: `frontend/src/app/(dashboard)/devices/page.tsx`
- Modify: `frontend/src/app/(dashboard)/assets/page.tsx`

**Step 1: 创建 useDebounce hook**

创建 `frontend/src/hooks/use-debounce.ts`:
```ts
'use client';
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

**Step 2: 修改 devices/page.tsx — 添加防抖 + 修复分页**

在 import 区域添加:
```ts
import { useDebounce } from '@/hooks/use-debounce';
```

在 `const [deviceType, setDeviceType] = useState('');` 之后添加:
```ts
const debouncedSearch = useDebounce(search);
```

将 useEffect 的依赖数组从 `[page, search, deviceType]` 改为 `[page, debouncedSearch, deviceType]`，并将 `if (search) params.set('search', search);` 改为 `if (debouncedSearch) params.set('search', debouncedSearch);`

修复分页 — 将:
```tsx
<Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={devices.length < 20}>下一页</Button>
```
改为:
```tsx
<Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>下一页</Button>
```

将页码显示改为:
```tsx
<span className="text-sm text-muted-foreground">共 {total} 条 · 第 {page}/{Math.max(1, Math.ceil(total / 20))} 页</span>
```

**Step 3: 同样修改 assets/page.tsx**

同样的模式：添加 `useDebounce` import，创建 `debouncedSearch`，修改 useEffect 依赖和搜索参数，修复分页按钮。

**Step 4: Commit**
```bash
git add frontend/src/hooks/use-debounce.ts frontend/src/app/\(dashboard\)/devices/page.tsx frontend/src/app/\(dashboard\)/assets/page.tsx
git commit -m "fix: add search debounce + fix pagination using total count"
```

---

### Task 18: 提取前端常量 (O6)

**Files:**
- Create: `frontend/src/lib/constants.ts`
- Modify: `frontend/src/app/(dashboard)/devices/page.tsx`
- Modify: `frontend/src/app/(dashboard)/assets/page.tsx`
- Modify: `frontend/src/app/(dashboard)/settings/page.tsx`

**Step 1: 创建 constants.ts**

创建 `frontend/src/lib/constants.ts`:
```ts
import { Smartphone, Tablet, Monitor, Tv, Watch, Glasses } from 'lucide-react';

export const DEVICE_ICONS: Record<string, React.ElementType> = {
  iPhone: Smartphone, iPad: Tablet, Mac: Monitor,
  AppleTV: Tv, AppleWatch: Watch, VisionPro: Glasses,
};

export const DEVICE_TYPES = ['iPhone', 'iPad', 'Mac', 'AppleTV', 'AppleWatch', 'VisionPro'];

export const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  pending: '待注册', enrolled: '已注册', unenrolled: '已注销',
};

export const ASSET_STATUS_LABELS: Record<string, string> = {
  in_use: '使用中', in_stock: '库存', repairing: '维修中', retired: '已退役', lost: '丢失',
};

export const ASSET_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  in_use: 'default', in_stock: 'secondary', repairing: 'outline', retired: 'secondary', lost: 'destructive',
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员', device_admin: '设备管理员', readonly: '只读用户',
};
```

**Step 2: 在各页面中替换本地常量为 import**

在 `devices/page.tsx` 中:
- 删除本地的 `DEVICE_ICONS`、`statusLabels`、`deviceTypes`
- 添加 `import { DEVICE_ICONS, ENROLLMENT_STATUS_LABELS, DEVICE_TYPES } from '@/lib/constants';`
- 将 `statusLabels` 引用替换为 `ENROLLMENT_STATUS_LABELS`

在 `assets/page.tsx` 中:
- 删除本地的 `statusLabels`、`statusVariant`
- 添加 `import { ASSET_STATUS_LABELS, ASSET_STATUS_VARIANT } from '@/lib/constants';`
- 替换引用

在 `settings/page.tsx` 中:
- 删除本地的 `roleLabels`
- 添加 `import { ROLE_LABELS } from '@/lib/constants';`
- 替换引用

**Step 3: Commit**
```bash
git add frontend/src/lib/constants.ts frontend/src/app/\(dashboard\)/devices/page.tsx frontend/src/app/\(dashboard\)/assets/page.tsx frontend/src/app/\(dashboard\)/settings/page.tsx
git commit -m "refactor: extract shared constants to lib/constants.ts"
```

---

## Phase 4: 功能扩充

### Task 19: 前端报表导出 CSV 按钮

**Files:**
- Modify: `frontend/src/app/(dashboard)/reports/page.tsx`

**Step 1: 添加 CSV 下载按钮**

在报表页面的每个报表 section 中添加导出按钮。在页面顶部添加下载函数:
```ts
const downloadCsv = async (type: 'devices' | 'assets') => {
  try {
    const res = await api.get(`/api/reports/${type}/export`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch {
    alert('导出失败');
  }
};
```

在设备统计和资产统计的 CardHeader 中添加导出按钮:
```tsx
<CardHeader className="flex flex-row items-center justify-between">
  <CardTitle>设备统计</CardTitle>
  <Button variant="outline" size="sm" onClick={() => downloadCsv('devices')}>导出 CSV</Button>
</CardHeader>
```

**Step 2: Commit**
```bash
git add frontend/src/app/\(dashboard\)/reports/page.tsx
git commit -m "feat: add CSV export buttons to reports page"
```

---

### Task 20: 后端输入验证 (F6)

**Files:**
- Modify: `backend/src/modules/auth/routes.ts`
- Modify: `backend/src/modules/devices/routes.ts`
- Modify: `backend/src/modules/assets/routes.ts`
- Modify: `backend/src/modules/profiles/routes.ts`

**Step 1: 为 auth 路由添加 Fastify JSON Schema 验证**

在 `backend/src/modules/auth/routes.ts` 中，将 login 路由:
```ts
fastify.post('/login', async (request, reply) => {
```
改为:
```ts
fastify.post('/login', {
  schema: {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 1 },
      },
    },
  },
}, async (request, reply) => {
```

将 register 路由添加 schema:
```ts
fastify.post('/register', {
  preHandler: [requireRole('super_admin')],
  schema: {
    body: {
      type: 'object',
      required: ['email', 'name', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        name: { type: 'string', minLength: 1, maxLength: 100 },
        password: { type: 'string', minLength: 6, maxLength: 128 },
        role: { type: 'string', enum: ['super_admin', 'device_admin', 'readonly'] },
      },
    },
  },
}, async (request, reply) => {
```

将 change-password 路由添加 schema:
```ts
fastify.post('/change-password', {
  preHandler: [authenticate],
  schema: {
    body: {
      type: 'object',
      required: ['currentPassword', 'newPassword'],
      properties: {
        currentPassword: { type: 'string', minLength: 1 },
        newPassword: { type: 'string', minLength: 6, maxLength: 128 },
      },
    },
  },
}, async (request, reply) => {
```

**Step 2: 为 devices 路由添加 schema**

POST /:id/commands:
```ts
fastify.post('/:id/commands', {
  schema: {
    body: {
      type: 'object',
      required: ['commandType'],
      properties: {
        commandType: { type: 'string', minLength: 1 },
        payload: { type: 'object' },
      },
    },
  },
}, async (request) => {
```

**Step 3: 为 assets 路由添加 schema**

POST /:
```ts
fastify.post('/', {
  schema: {
    body: {
      type: 'object',
      required: ['deviceId'],
      properties: {
        deviceId: { type: 'string', format: 'uuid' },
        purchaseDate: { type: 'string' },
        purchasePrice: { type: 'number' },
        warrantyEnd: { type: 'string' },
        assignedTo: { type: 'string' },
        department: { type: 'string' },
        location: { type: 'string' },
        status: { type: 'string', enum: ['in_use', 'in_stock', 'repairing', 'retired', 'lost'] },
        notes: { type: 'string' },
      },
    },
  },
}, async (request) => {
```

**Step 4: 为 profiles 路由添加 schema**

POST /:
```ts
fastify.post('/', {
  schema: {
    body: {
      type: 'object',
      required: ['name', 'identifier', 'payloadType', 'payload'],
      properties: {
        name: { type: 'string', minLength: 1 },
        identifier: { type: 'string', minLength: 1 },
        payloadType: { type: 'string', minLength: 1 },
        payload: { type: 'object' },
        description: { type: 'string' },
      },
    },
  },
}, async (request) => {
```

**Step 5: Commit**
```bash
git add backend/src/modules/
git commit -m "feat: add Fastify JSON Schema validation to all routes"
```

---

## 最终验证

### Task 21: 全局检查与最终提交

**Step 1: 确认 TypeScript 编译通过**
```bash
cd backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
```

**Step 2: 确认 Prisma schema 有效**
```bash
cd backend && npx prisma validate
```

**Step 3: 确认所有文件已提交**
```bash
git status
git log --oneline -20
```

---

## 任务总结

| Phase | Tasks | 内容 |
|-------|-------|------|
| Phase 1 | Task 1-10 | 后端 Bug 修复 + 安全加固 + 依赖清理 + 共享类型 |
| Phase 2 | Task 11-14 | 审计日志接入 + CRUD 端点 + MDM enrollment + 报表缓存 |
| Phase 3 | Task 15-18 | 前端 Bug 修复 + 防抖 + 分页 + 常量提取 |
| Phase 4 | Task 19-20 | CSV 导出 + 输入验证 |
| 验证 | Task 21 | TypeScript 编译 + Prisma 验证 |
