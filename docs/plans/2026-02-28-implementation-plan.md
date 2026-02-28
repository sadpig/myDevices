# Apple 设备管理系统 (myDevices) 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建企业级 Apple 设备管理系统，集成 MDM 协议和资产管理功能，支持 6 种 Apple 设备类型。

**Architecture:** 模块化单体架构 — Fastify TypeScript 后端（按功能模块划分）+ 独立 Next.js 14 前端。PostgreSQL 存储主数据，Redis 处理命令队列和缓存。MDM 协议通过 HTTP/2 直连 APNs。

**Tech Stack:** Next.js 14 (App Router) + shadcn/ui + Tailwind CSS | Fastify + TypeScript + Prisma + PostgreSQL + Redis (BullMQ) | JWT + bcrypt | Docker Compose

---

## Phase 1: 项目基础设施

### Task 1: 初始化 monorepo 和基础配置

**Files:**
- Create: `package.json` (root)
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `shared/types/index.ts`
- Create: `docker-compose.yml`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: 初始化 root package.json**

```bash
cd /Users/tanwei/Downloads/MyProjectes/myDevices
git init
npm init -y
```

修改 `package.json`，添加 workspaces:
```json
{
  "name": "mydevices",
  "private": true,
  "workspaces": ["backend", "frontend", "shared"]
}
```

**Step 2: 初始化后端项目**

```bash
mkdir -p backend/src
cd backend
npm init -y
npm install fastify @fastify/cors @fastify/jwt @fastify/cookie @fastify/swagger
npm install prisma @prisma/client bullmq ioredis bcryptjs uuid pino
npm install -D typescript @types/node @types/bcryptjs @types/uuid tsx
npx tsc --init
```

`backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: 初始化前端项目**

```bash
cd /Users/tanwei/Downloads/MyProjectes/myDevices
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 4: 创建 docker-compose.yml**

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: mydevices
      POSTGRES_PASSWORD: mydevices_dev
      POSTGRES_DB: mydevices
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

**Step 5: 创建 .env.example 和 .gitignore**

`.env.example`:
```env
DATABASE_URL=postgresql://mydevices:mydevices_dev@localhost:5432/mydevices
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-in-production
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_KEY_PATH=
PORT=3001
```

`.gitignore`:
```
node_modules/
dist/
.env
.next/
*.log
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: initialize monorepo with backend, frontend, and shared packages"
```

---

### Task 2: Prisma Schema 和数据库迁移

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/prisma/seed.ts`

**Step 1: 初始化 Prisma**

```bash
cd /Users/tanwei/Downloads/MyProjectes/myDevices/backend
npx prisma init
```

**Step 2: 编写 Prisma Schema**

`backend/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum DeviceType {
  iPhone
  iPad
  Mac
  AppleTV
  AppleWatch
  VisionPro
}

enum EnrollmentStatus {
  pending
  enrolled
  unenrolled
}

enum AssetStatus {
  in_use
  in_stock
  repairing
  retired
  lost
}

enum UserRole {
  super_admin
  device_admin
  readonly
}

enum CommandStatus {
  queued
  sent
  acknowledged
  error
  not_now
}

model User {
  id           String    @id @default(uuid())
  email        String    @unique
  name         String
  role         UserRole  @default(readonly)
  passwordHash String    @map("password_hash")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  auditLogs    AuditLog[]

  @@map("users")
}

model Device {
  id               String           @id @default(uuid())
  udid             String           @unique
  serialNumber     String           @unique @map("serial_number")
  deviceType       DeviceType       @map("device_type")
  model            String?
  modelName        String?          @map("model_name")
  osVersion        String?          @map("os_version")
  buildVersion     String?          @map("build_version")
  deviceName       String?          @map("device_name")
  productName      String?          @map("product_name")
  storageCapacity  BigInt?          @map("storage_capacity")
  wifiMac          String?          @map("wifi_mac")
  bluetoothMac     String?          @map("bluetooth_mac")
  enrollmentStatus EnrollmentStatus @default(pending) @map("enrollment_status")
  lastSeenAt       DateTime?        @map("last_seen_at")
  mdmEnrolled      Boolean          @default(false) @map("mdm_enrolled")
  supervised       Boolean          @default(false)
  pushMagic        String?          @map("push_magic")
  pushToken        String?          @map("push_token")
  unlockToken      String?          @map("unlock_token")
  createdAt        DateTime         @default(now()) @map("created_at")
  updatedAt        DateTime         @updatedAt @map("updated_at")

  asset    Asset?
  commands MDMCommand[]
  profiles DeviceProfile[]

  @@map("devices")
}

model Asset {
  id            String      @id @default(uuid())
  deviceId      String      @unique @map("device_id")
  purchaseDate  DateTime?   @map("purchase_date")
  purchasePrice Decimal?    @map("purchase_price") @db.Decimal(10, 2)
  warrantyEnd   DateTime?   @map("warranty_end")
  assignedTo    String?     @map("assigned_to")
  department    String?
  location      String?
  status        AssetStatus @default(in_stock)
  notes         String?
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@map("assets")
}

model MDMCommand {
  id             String        @id @default(uuid())
  deviceId       String        @map("device_id")
  commandType    String        @map("command_type")
  payload        Json?
  status         CommandStatus @default(queued)
  requestId      String        @unique @map("request_id")
  queuedAt       DateTime      @default(now()) @map("queued_at")
  sentAt         DateTime?     @map("sent_at")
  acknowledgedAt DateTime?     @map("acknowledged_at")
  result         Json?

  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@map("mdm_commands")
}

model Profile {
  id          String   @id @default(uuid())
  name        String
  identifier  String   @unique
  payloadType String   @map("payload_type")
  payload     Json
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  devices DeviceProfile[]

  @@map("profiles")
}

model DeviceProfile {
  id          String   @id @default(uuid())
  deviceId    String   @map("device_id")
  profileId   String   @map("profile_id")
  installedAt DateTime @default(now()) @map("installed_at")

  device  Device  @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([deviceId, profileId])
  @@map("device_profiles")
}

model AuditLog {
  id         String   @id @default(uuid())
  userId     String?  @map("user_id")
  action     String
  targetType String   @map("target_type")
  targetId   String?  @map("target_id")
  details    Json?
  ipAddress  String?  @map("ip_address")
  createdAt  DateTime @default(now()) @map("created_at")

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([targetType, targetId])
  @@map("audit_logs")
}
```

**Step 3: 运行迁移**

```bash
docker compose up -d
cp .env.example .env
npx prisma migrate dev --name init
```

**Step 4: 编写种子数据**

`backend/prisma/seed.ts`:
```typescript
import { PrismaClient, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@mydevices.local' },
    update: {},
    create: {
      email: 'admin@mydevices.local',
      name: 'System Admin',
      role: UserRole.super_admin,
      passwordHash: hashSync('admin123', 10),
    },
  });
  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

在 `backend/package.json` 添加:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

```bash
npx prisma db seed
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema with all core models and seed data"
```


---

## Phase 2: 后端核心模块

### Task 3: Fastify 应用入口和插件配置

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/plugins/prisma.ts`
- Create: `backend/src/plugins/redis.ts`
- Create: `backend/src/plugins/auth.ts`
- Create: `backend/src/middleware/authenticate.ts`

**Step 1: 创建 Prisma 插件**

`backend/src/plugins/prisma.ts`:
```typescript
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async (fastify) => {
  const prisma = new PrismaClient();
  await prisma.$connect();
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
```

**Step 2: 创建 Redis 插件**

`backend/src/plugins/redis.ts`:
```typescript
import fp from 'fastify-plugin';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => {
    redis.disconnect();
  });
});
```

**Step 3: 创建认证中间件**

`backend/src/middleware/authenticate.ts`:
```typescript
import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    const user = request.user as { role: string };
    if (!roles.includes(user.role)) {
      reply.status(403).send({ error: 'Forbidden' });
    }
  };
}
```

**Step 4: 创建 app.ts**

`backend/src/app.ts`:
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import prismaPlugin from './plugins/prisma';
import redisPlugin from './plugins/redis';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' });
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // Register route modules
  await app.register(import('./modules/auth/routes'), { prefix: '/api/auth' });
  await app.register(import('./modules/devices/routes'), { prefix: '/api/devices' });
  await app.register(import('./modules/assets/routes'), { prefix: '/api/assets' });
  await app.register(import('./modules/mdm/routes'), { prefix: '/mdm' });
  await app.register(import('./modules/audit/routes'), { prefix: '/api/audit-logs' });
  await app.register(import('./modules/reports/routes'), { prefix: '/api/reports' });
  await app.register(import('./modules/profiles/routes'), { prefix: '/api/profiles' });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

**Step 5: 创建 server.ts**

`backend/src/server.ts`:
```typescript
import { buildApp } from './app';

async function start() {
  const app = await buildApp();
  const port = parseInt(process.env.PORT || '3001');
  await app.listen({ port, host: '0.0.0.0' });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Fastify app entry, plugins (prisma, redis), and auth middleware"
```

---

### Task 4: 认证模块 (auth)

**Files:**
- Create: `backend/src/modules/auth/routes.ts`
- Create: `backend/src/modules/auth/service.ts`
- Test: `backend/src/modules/auth/__tests__/auth.test.ts`

**Step 1: 编写认证 service**

`backend/src/modules/auth/service.ts`:
```typescript
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async createUser(email: string, name: string, password: string, role: UserRole = 'readonly') {
    const passwordHash = await bcrypt.hash(password, 12);
    return this.prisma.user.create({
      data: { email, name, passwordHash, role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }
}
```

**Step 2: 编写认证路由**

`backend/src/modules/auth/routes.ts`:
```typescript
import { FastifyPluginAsync } from 'fastify';
import { AuthService } from './service';
import { authenticate } from '../../middleware/authenticate';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService(fastify.prisma);

  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    try {
      const user = await authService.login(email, password);
      const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
      return { token, user };
    } catch {
      reply.status(401).send({ error: 'Invalid credentials' });
    }
  });

  fastify.post('/logout', async () => {
    return { message: 'Logged out' };
  });

  fastify.get('/me', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.user as { id: string };
    return authService.getUserById(id);
  });
};

export default authRoutes;
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add auth module with login, logout, and me endpoints"
```

---

### Task 5: 设备管理模块 (devices)

**Files:**
- Create: `backend/src/modules/devices/routes.ts`
- Create: `backend/src/modules/devices/service.ts`
- Create: `backend/src/modules/devices/schemas.ts`

**Step 1: 编写设备 service**

`backend/src/modules/devices/service.ts`:
```typescript
import { PrismaClient, DeviceType, EnrollmentStatus } from '@prisma/client';

interface DeviceQuery {
  page?: number;
  limit?: number;
  deviceType?: DeviceType;
  enrollmentStatus?: EnrollmentStatus;
  search?: string;
}

export class DeviceService {
  constructor(private prisma: PrismaClient) {}

  async list(query: DeviceQuery) {
    const { page = 1, limit = 20, deviceType, enrollmentStatus, search } = query;
    const where: any = {};
    if (deviceType) where.deviceType = deviceType;
    if (enrollmentStatus) where.enrollmentStatus = enrollmentStatus;
    if (search) {
      where.OR = [
        { deviceName: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { modelName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { asset: true },
      }),
      this.prisma.device.count({ where }),
    ]);
    return { devices, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    return this.prisma.device.findUnique({
      where: { id },
      include: { asset: true, commands: { orderBy: { queuedAt: 'desc' }, take: 20 } },
    });
  }

  async update(id: string, data: Partial<{ deviceName: string; supervised: boolean }>) {
    return this.prisma.device.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.device.delete({ where: { id } });
  }

  async getStats() {
    const [byType, byStatus, total] = await Promise.all([
      this.prisma.device.groupBy({ by: ['deviceType'], _count: true }),
      this.prisma.device.groupBy({ by: ['enrollmentStatus'], _count: true }),
      this.prisma.device.count(),
    ]);
    return { total, byType, byStatus };
  }
}
```

**Step 2: 编写设备路由**

`backend/src/modules/devices/routes.ts`:
```typescript
import { FastifyPluginAsync } from 'fastify';
import { DeviceService } from './service';
import { authenticate } from '../../middleware/authenticate';

const deviceRoutes: FastifyPluginAsync = async (fastify) => {
  const deviceService = new DeviceService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const query = request.query as any;
    return deviceService.list(query);
  });

  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const device = await deviceService.getById(id);
    if (!device) throw { statusCode: 404, message: 'Device not found' };
    return device;
  });

  fastify.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    return deviceService.update(id, data);
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await deviceService.remove(id);
    reply.status(204).send();
  });

  fastify.get('/stats', async () => {
    return deviceService.getStats();
  });
};

export default deviceRoutes;
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add devices module with CRUD and stats endpoints"
```

---

### Task 6: 资产管理模块 (assets)

**Files:**
- Create: `backend/src/modules/assets/routes.ts`
- Create: `backend/src/modules/assets/service.ts`

**Step 1: 编写资产 service**

`backend/src/modules/assets/service.ts`:
```typescript
import { PrismaClient, AssetStatus } from '@prisma/client';

interface AssetQuery {
  page?: number;
  limit?: number;
  status?: AssetStatus;
  department?: string;
  search?: string;
}

interface CreateAssetData {
  deviceId: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  warrantyEnd?: Date;
  assignedTo?: string;
  department?: string;
  location?: string;
  status?: AssetStatus;
  notes?: string;
}

export class AssetService {
  constructor(private prisma: PrismaClient) {}

  async list(query: AssetQuery) {
    const { page = 1, limit = 20, status, department, search } = query;
    const where: any = {};
    if (status) where.status = status;
    if (department) where.department = department;
    if (search) {
      where.OR = [
        { assignedTo: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { device: { serialNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { device: { select: { serialNumber: true, deviceName: true, deviceType: true, modelName: true } } },
      }),
      this.prisma.asset.count({ where }),
    ]);
    return { assets, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    return this.prisma.asset.findUnique({
      where: { id },
      include: { device: true },
    });
  }

  async create(data: CreateAssetData) {
    return this.prisma.asset.create({
      data: { ...data, purchasePrice: data.purchasePrice ? data.purchasePrice : undefined },
      include: { device: { select: { serialNumber: true, deviceName: true, deviceType: true } } },
    });
  }

  async update(id: string, data: Partial<CreateAssetData>) {
    return this.prisma.asset.update({ where: { id }, data });
  }

  async getStats() {
    const [byStatus, byDepartment, total] = await Promise.all([
      this.prisma.asset.groupBy({ by: ['status'], _count: true }),
      this.prisma.asset.groupBy({ by: ['department'], _count: true }),
      this.prisma.asset.count(),
    ]);
    return { total, byStatus, byDepartment };
  }
}
```

**Step 2: 编写资产路由**

`backend/src/modules/assets/routes.ts`:
```typescript
import { FastifyPluginAsync } from 'fastify';
import { AssetService } from './service';
import { authenticate } from '../../middleware/authenticate';

const assetRoutes: FastifyPluginAsync = async (fastify) => {
  const assetService = new AssetService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    return assetService.list(request.query as any);
  });

  fastify.get('/stats', async () => {
    return assetService.getStats();
  });

  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const asset = await assetService.getById(id);
    if (!asset) throw { statusCode: 404, message: 'Asset not found' };
    return asset;
  });

  fastify.post('/', async (request, reply) => {
    const data = request.body as any;
    const asset = await assetService.create(data);
    reply.status(201).send(asset);
  });

  fastify.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return assetService.update(id, request.body as any);
  });
};

export default assetRoutes;
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add assets module with CRUD and stats endpoints"
```


---

### Task 7: MDM 协议模块

**Files:**
- Create: `backend/src/modules/mdm/routes.ts`
- Create: `backend/src/modules/mdm/checkin.ts`
- Create: `backend/src/modules/mdm/commands.ts`
- Create: `backend/src/modules/mdm/apns.ts`

**Step 1: 创建 APNs 推送服务**

`backend/src/modules/mdm/apns.ts`:
```typescript
import http2 from 'node:http2';
import fs from 'node:fs';

interface APNsConfig {
  keyId: string;
  teamId: string;
  keyPath: string;
  production: boolean;
}

export class APNsService {
  private config: APNsConfig;
  private host: string;

  constructor(config: APNsConfig) {
    this.config = config;
    this.host = config.production
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';
  }

  async sendPush(pushToken: string, pushMagic: string): Promise<boolean> {
    const payload = JSON.stringify({ mdm: pushMagic });

    return new Promise((resolve, reject) => {
      const client = http2.connect(this.host);
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${pushToken}`,
        'apns-topic': pushMagic,
        'apns-push-type': 'mdm',
        'apns-priority': '10',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      });

      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        client.close();
        resolve(true);
      });
      req.on('error', (err) => {
        client.close();
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }
}
```

**Step 2: 创建 Check-in 处理**

`backend/src/modules/mdm/checkin.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

export class CheckinService {
  constructor(private prisma: PrismaClient) {}

  async handleAuthenticate(udid: string, serialNumber: string, model: string, deviceName: string, osVersion: string, deviceType: string) {
    const device = await this.prisma.device.upsert({
      where: { udid },
      update: { serialNumber, model, deviceName, osVersion, lastSeenAt: new Date() },
      create: {
        udid,
        serialNumber,
        deviceType: this.mapDeviceType(deviceType),
        model,
        deviceName,
        osVersion,
        enrollmentStatus: 'pending',
      },
    });
    return device;
  }

  async handleTokenUpdate(udid: string, pushMagic: string, pushToken: string, unlockToken?: string) {
    return this.prisma.device.update({
      where: { udid },
      data: {
        pushMagic,
        pushToken,
        unlockToken,
        enrollmentStatus: 'enrolled',
        mdmEnrolled: true,
        lastSeenAt: new Date(),
      },
    });
  }

  async handleCheckOut(udid: string) {
    return this.prisma.device.update({
      where: { udid },
      data: {
        enrollmentStatus: 'unenrolled',
        mdmEnrolled: false,
        pushMagic: null,
        pushToken: null,
        lastSeenAt: new Date(),
      },
    });
  }

  private mapDeviceType(type: string) {
    const map: Record<string, any> = {
      'iPhone': 'iPhone', 'iPad': 'iPad', 'Mac': 'Mac',
      'AppleTV': 'AppleTV', 'AppleWatch': 'AppleWatch', 'RealityDevice': 'VisionPro',
    };
    return map[type] || 'iPhone';
  }
}
```

**Step 3: 创建命令队列服务**

`backend/src/modules/mdm/commands.ts`:
```typescript
import { PrismaClient, CommandStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { APNsService } from './apns';

export class CommandService {
  private queue: Queue;

  constructor(
    private prisma: PrismaClient,
    private apns: APNsService,
    redisUrl: string,
  ) {
    this.queue = new Queue('mdm-commands', { connection: { url: redisUrl } });
  }

  async queueCommand(deviceId: string, commandType: string, payload: Record<string, unknown> = {}) {
    const device = await this.prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    const command = await this.prisma.mDMCommand.create({
      data: {
        deviceId,
        commandType,
        payload,
        status: 'queued',
        requestId: crypto.randomUUID(),
      },
    });

    // Send APNs push to wake device
    if (device.pushToken && device.pushMagic) {
      await this.apns.sendPush(device.pushToken, device.pushMagic);
      await this.prisma.mDMCommand.update({
        where: { id: command.id },
        data: { status: 'sent', sentAt: new Date() },
      });
    }

    return command;
  }

  async getNextCommand(deviceId: string) {
    return this.prisma.mDMCommand.findFirst({
      where: { deviceId, status: { in: ['queued', 'sent'] } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async acknowledgeCommand(requestId: string, status: CommandStatus, result?: Record<string, unknown>) {
    return this.prisma.mDMCommand.update({
      where: { requestId },
      data: { status, acknowledgedAt: new Date(), result: result ?? undefined },
    });
  }

  async getCommandHistory(deviceId: string, page = 1, limit = 20) {
    const [commands, total] = await Promise.all([
      this.prisma.mDMCommand.findMany({
        where: { deviceId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.mDMCommand.count({ where: { deviceId } }),
    ]);
    return { commands, total, page, limit };
  }
}
```

**Step 4: 创建 MDM 路由**

`backend/src/modules/mdm/routes.ts`:
```typescript
import { FastifyPluginAsync } from 'fastify';
import { CheckinService } from './checkin';
import { CommandService } from './commands';
import { APNsService } from './apns';

const mdmRoutes: FastifyPluginAsync = async (fastify) => {
  const checkinService = new CheckinService(fastify.prisma);
  const apnsService = new APNsService({
    keyId: process.env.APNS_KEY_ID || '',
    teamId: process.env.APNS_TEAM_ID || '',
    keyPath: process.env.APNS_KEY_PATH || '',
    production: process.env.NODE_ENV === 'production',
  });
  const commandService = new CommandService(
    fastify.prisma, apnsService, process.env.REDIS_URL || 'redis://localhost:6379'
  );

  // Device check-in endpoint
  fastify.put('/checkin', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const messageType = body.MessageType;

    switch (messageType) {
      case 'Authenticate':
        const device = await checkinService.handleAuthenticate(
          body.UDID, body.SerialNumber, body.Model, body.DeviceName, body.OSVersion, body.ProductName
        );
        return reply.send({});

      case 'TokenUpdate':
        await checkinService.handleTokenUpdate(body.UDID, body.PushMagic, body.Token, body.UnlockToken);
        return reply.send({});

      case 'CheckOut':
        await checkinService.handleCheckOut(body.UDID);
        return reply.send({});

      default:
        return reply.status(400).send({ error: 'Unknown message type' });
    }
  });

  // Device command endpoint
  fastify.put('/connect', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const udid = body.UDID;
    const status = body.Status;
    const requestId = body.CommandUUID;

    // Acknowledge previous command if present
    if (requestId && status) {
      const cmdStatus = status === 'Acknowledged' ? 'acknowledged'
        : status === 'Error' ? 'error'
        : status === 'NotNow' ? 'not_now' : 'acknowledged';
      await commandService.acknowledgeCommand(requestId, cmdStatus, body);
    }

    // Find device and get next command
    const device = await fastify.prisma.device.findUnique({ where: { udid } });
    if (!device) return reply.status(404).send({});

    await fastify.prisma.device.update({ where: { udid }, data: { lastSeenAt: new Date() } });

    const nextCommand = await commandService.getNextCommand(device.id);
    if (!nextCommand) return reply.send({});

    // Return command as plist-like response
    return reply.send({
      Command: { RequestType: nextCommand.commandType, ...nextCommand.payload },
      CommandUUID: nextCommand.requestId,
    });
  });
};

export default mdmRoutes;
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add MDM protocol module (checkin, commands, APNs)"
```

---

### Task 8: 配置描述文件模块 (profiles)

**Files:**
- Create: `backend/src/modules/profiles/routes.ts`
- Create: `backend/src/modules/profiles/service.ts`

**Step 1: 编写 Profile Service**

`backend/src/modules/profiles/service.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

export class ProfileService {
  constructor(private prisma: PrismaClient) {}

  async list(page = 1, limit = 20) {
    const [profiles, total] = await Promise.all([
      this.prisma.profile.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.profile.count(),
    ]);
    return { profiles, total, page, limit };
  }

  async getById(id: string) {
    return this.prisma.profile.findUniqueOrThrow({ where: { id } });
  }

  async create(data: { name: string; identifier: string; payloadType: string; payload: any; description?: string }) {
    return this.prisma.profile.create({ data });
  }

  async update(id: string, data: Partial<{ name: string; identifier: string; payloadType: string; payload: any; description: string }>) {
    return this.prisma.profile.update({ where: { id }, data });
  }

  async installOnDevices(profileId: string, deviceIds: string[], commandService: any) {
    const profile = await this.prisma.profile.findUniqueOrThrow({ where: { id: profileId } });
    const results = await Promise.all(
      deviceIds.map((deviceId) =>
        commandService.queueCommand(deviceId, 'InstallProfile', { Payload: profile.payload })
      )
    );
    return results;
  }
}
```

**Step 2: 编写 Profile 路由**

`backend/src/modules/profiles/routes.ts`:
```typescript
import { FastifyPluginAsync } from 'fastify';
import { ProfileService } from './service';
import { authenticate } from '../../middleware/authenticate';

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  const profileService = new ProfileService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const { page = '1', limit = '20' } = request.query as Record<string, string>;
    return profileService.list(parseInt(page), parseInt(limit));
  });

  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return profileService.getById(id);
  });

  fastify.post('/', async (request) => {
    const body = request.body as { name: string; identifier: string; payloadType: string; payload: any; description?: string };
    return profileService.create(body);
  });

  fastify.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    return profileService.update(id, body);
  });

  fastify.post('/:id/install', async (request) => {
    const { id } = request.params as { id: string };
    const { deviceIds } = request.body as { deviceIds: string[] };
    return profileService.installOnDevices(id, deviceIds, null); // TODO: inject commandService
  });
};

export default profileRoutes;
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add profile management module"
```

---

### Task 9: 审计日志模块 (audit)

**Files:**
- Create: `backend/src/modules/audit/routes.ts`
- Create: `backend/src/modules/audit/service.ts`

**Step 1: 编写审计 Service**

`backend/src/modules/audit/service.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

export class AuditService {
  constructor(private prisma: PrismaClient) {}

  async log(userId: string, action: string, targetType: string, targetId: string, details?: any, ipAddress?: string) {
    return this.prisma.auditLog.create({
      data: { userId, action, targetType, targetId, details, ipAddress },
    });
  }

  async list(filters: { userId?: string; action?: string; targetType?: string; page?: number; limit?: number }) {
    const { userId, action, targetType, page = 1, limit = 50 } = filters;
    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { logs, total, page, limit };
  }
}
```

**Step 2: 编写审计路由**

`backend/src/modules/audit/routes.ts`:
```typescript
import { FastifyPluginAsync } from 'fastify';
import { AuditService } from './service';
import { authenticate } from '../../middleware/authenticate';

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  const auditService = new AuditService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const { userId, action, targetType, page = '1', limit = '50' } = request.query as Record<string, string>;
    return auditService.list({ userId, action, targetType, page: parseInt(page), limit: parseInt(limit) });
  });
};

export default auditRoutes;
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add audit log module"
```

---

### Task 10: 报表模块 (reports)

**Files:**
- Create: `backend/src/modules/reports/routes.ts`
- Create: `backend/src/modules/reports/service.ts`

**Step 1: 编写报表 Service**

`backend/src/modules/reports/service.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  async deviceStats() {
    const [byType, byStatus, byOS, total] = await Promise.all([
      this.prisma.device.groupBy({ by: ['deviceType'], _count: true }),
      this.prisma.device.groupBy({ by: ['enrollmentStatus'], _count: true }),
      this.prisma.device.groupBy({ by: ['osVersion'], _count: true, orderBy: { _count: { osVersion: 'desc' } }, take: 10 }),
      this.prisma.device.count(),
    ]);
    return { total, byType, byStatus, byOS };
  }

  async assetStats() {
    const [byStatus, byDepartment, total] = await Promise.all([
      this.prisma.asset.groupBy({ by: ['status'], _count: true }),
      this.prisma.asset.groupBy({ by: ['department'], _count: true }),
      this.prisma.asset.count(),
    ]);
    return { total, byStatus, byDepartment };
  }

  async complianceReport() {
    const [enrolled, unenrolled, supervised, unsupervised] = await Promise.all([
      this.prisma.device.count({ where: { mdmEnrolled: true } }),
      this.prisma.device.count({ where: { mdmEnrolled: false } }),
      this.prisma.device.count({ where: { supervised: true } }),
      this.prisma.device.count({ where: { supervised: false } }),
    ]);
    return { enrolled, unenrolled, supervised, unsupervised, enrollmentRate: enrolled / (enrolled + unenrolled) || 0 };
  }
}
```

**Step 2: 编写报表路由**

`backend/src/modules/reports/routes.ts`:
```typescript
import { FastifyPluginAsync } from 'fastify';
import { ReportService } from './service';
import { authenticate } from '../../middleware/authenticate';

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  const reportService = new ReportService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/devices', async () => reportService.deviceStats());
  fastify.get('/assets', async () => reportService.assetStats());
  fastify.get('/compliance', async () => reportService.complianceReport());
};

export default reportRoutes;
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add reports module (device stats, asset stats, compliance)"
```

---

## Phase 3: 前端实现

### Task 8: 前端基础布局

**Files:**
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/components/layout/sidebar.tsx`
- Create: `frontend/src/components/layout/header.tsx`
- Create: `frontend/src/lib/api.ts`

**Step 1: 安装 shadcn/ui 和依赖**

```bash
cd /Users/tanwei/Downloads/MyProjectes/myDevices/frontend
npx shadcn@latest init
npx shadcn@latest add button card table input dialog dropdown-menu badge tabs avatar separator sheet
npm install @tanstack/react-table recharts react-hook-form @hookform/resolvers zod lucide-react axios date-fns
```

**Step 2: 创建 API Client**

`frontend/src/lib/api.ts`:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
```

**Step 3: 创建 Sidebar 组件**

`frontend/src/components/layout/sidebar.tsx`:
```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Smartphone, Package, Shield,
  FileText, ScrollText, BarChart3, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/devices', label: '设备管理', icon: Smartphone },
  { href: '/assets', label: '资产管理', icon: Package },
  { href: '/profiles', label: '配置描述文件', icon: Shield },
  { href: '/audit-logs', label: '审计日志', icon: ScrollText },
  { href: '/reports', label: '报表中心', icon: BarChart3 },
  { href: '/settings', label: '系统设置', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 border-r bg-gray-50/40 min-h-screen p-4">
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold">myDevices</h1>
        <p className="text-sm text-muted-foreground">Apple 设备管理</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-gray-100'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

**Step 4: 创建根布局**

`frontend/src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'myDevices - Apple 设备管理系统',
  description: '企业级 Apple 设备管理与 MDM 解决方案',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add frontend base layout with sidebar navigation and API client"
```

---

### Task 9: 登录页面

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/hooks/use-auth.ts`

**Step 1: 创建 auth hook**

`frontend/src/hooks/use-auth.ts`:
```typescript
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/api/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    router.push('/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  }, [router]);

  return { user, loading, login, logout };
}
```

**Step 2: 创建登录页面**

`frontend/src/app/login/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('邮箱或密码错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">myDevices</CardTitle>
          <p className="text-muted-foreground">Apple 设备管理系统</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="email" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add login page and auth hook"
```

---

### Task 10: Dashboard 仪表盘

**Files:**
- Create: `frontend/src/app/(main)/layout.tsx`
- Create: `frontend/src/app/(main)/dashboard/page.tsx`
- Create: `frontend/src/components/dashboard/stats-cards.tsx`
- Create: `frontend/src/components/dashboard/device-chart.tsx`

**Step 1: 创建主布局（带 Sidebar）**

`frontend/src/app/(main)/layout.tsx`:
```tsx
import { Sidebar } from '@/components/layout/sidebar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

**Step 2: 创建统计卡片组件**

`frontend/src/components/dashboard/stats-cards.tsx`:
```tsx
'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Laptop, Tablet, Tv, Watch, Glasses } from 'lucide-react';

interface StatsData {
  totalDevices: number;
  enrolledDevices: number;
  devicesByType: Record<string, number>;
  assetsByStatus: Record<string, number>;
}

const deviceIcons: Record<string, any> = {
  iPhone: Smartphone, iPad: Tablet, Mac: Laptop,
  AppleTV: Tv, AppleWatch: Watch, VisionPro: Glasses,
};

export function StatsCards({ data }: { data: StatsData }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">设备总数</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalDevices}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">已注册 MDM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.enrolledDevices}</div>
        </CardContent>
      </Card>
      {Object.entries(data.devicesByType).map(([type, count]) => {
        const Icon = deviceIcons[type] || Smartphone;
        return (
          <Card key={type}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{type}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

**Step 3: 创建 Dashboard 页面**

`frontend/src/app/(main)/dashboard/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { StatsCards } from '@/components/dashboard/stats-cards';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/api/reports/devices').then((res) => setStats(res.data));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">仪表盘</h2>
      {stats && <StatsCards data={stats} />}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add dashboard page with stats cards and device chart"
```

---

### Task 11: 设备列表和详情页

**Files:**
- Create: `frontend/src/app/(main)/devices/page.tsx`
- Create: `frontend/src/app/(main)/devices/[id]/page.tsx`
- Create: `frontend/src/components/devices/device-table.tsx`
- Create: `frontend/src/components/devices/device-detail.tsx`
- Create: `frontend/src/components/devices/command-dialog.tsx`

**Step 1: 创建设备表格组件**

`frontend/src/components/devices/device-table.tsx`:
```tsx
'use client';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Device {
  id: string;
  deviceName: string;
  serialNumber: string;
  deviceType: string;
  osVersion: string;
  enrollmentStatus: string;
  lastSeenAt: string;
}

const statusColors: Record<string, string> = {
  enrolled: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  unenrolled: 'bg-red-100 text-red-800',
};

export function DeviceTable({ devices }: { devices: Device[] }) {
  const router = useRouter();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>设备名称</TableHead>
          <TableHead>序列号</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>系统版本</TableHead>
          <TableHead>注册状态</TableHead>
          <TableHead>最后在线</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {devices.map((device) => (
          <TableRow key={device.id} className="cursor-pointer" onClick={() => router.push(`/devices/${device.id}`)}>
            <TableCell className="font-medium">{device.deviceName || '-'}</TableCell>
            <TableCell>{device.serialNumber}</TableCell>
            <TableCell><Badge variant="outline">{device.deviceType}</Badge></TableCell>
            <TableCell>{device.osVersion || '-'}</TableCell>
            <TableCell><Badge className={statusColors[device.enrollmentStatus]}>{device.enrollmentStatus}</Badge></TableCell>
            <TableCell>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('zh-CN') : '-'}</TableCell>
            <TableCell><Button variant="ghost" size="sm">详情</Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Step 2: 创建命令下发对话框**

`frontend/src/components/devices/command-dialog.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import api from '@/lib/api';

const commands = [
  { type: 'DeviceInformation', label: '查询设备信息' },
  { type: 'DeviceLock', label: '锁定设备' },
  { type: 'EraseDevice', label: '擦除设备' },
  { type: 'RestartDevice', label: '重启设备' },
  { type: 'ShutDownDevice', label: '关机' },
  { type: 'InstalledApplicationList', label: '查询已安装应用' },
  { type: 'CertificateList', label: '查询证书列表' },
  { type: 'ProfileList', label: '查询描述文件列表' },
];

export function CommandDialog({ deviceId }: { deviceId: string }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState('');

  const sendCommand = async (commandType: string) => {
    setSending(commandType);
    try {
      await api.post(`/api/devices/${deviceId}/commands`, { commandType });
      setOpen(false);
    } finally {
      setSending('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>发送命令</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>发送 MDM 命令</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {commands.map((cmd) => (
            <Button
              key={cmd.type}
              variant="outline"
              disabled={sending === cmd.type}
              onClick={() => sendCommand(cmd.type)}
            >
              {sending === cmd.type ? '发送中...' : cmd.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: 创建设备列表页**

`frontend/src/app/(main)/devices/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { DeviceTable } from '@/components/devices/device-table';
import { Input } from '@/components/ui/input';

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/api/devices', { params: { search } }).then((res) => setDevices(res.data.devices));
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">设备管理</h2>
      </div>
      <Input placeholder="搜索设备名称、序列号..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DeviceTable devices={devices} />
    </div>
  );
}
```

**Step 4: 创建设备详情页**

`frontend/src/app/(main)/devices/[id]/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CommandDialog } from '@/components/devices/command-dialog';

export default function DeviceDetailPage() {
  const { id } = useParams();
  const [device, setDevice] = useState<any>(null);

  useEffect(() => {
    api.get(`/api/devices/${id}`).then((res) => setDevice(res.data));
  }, [id]);

  if (!device) return <div>加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">{device.deviceName || device.serialNumber}</h2>
        <CommandDialog deviceId={device.id} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>设备信息</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p>类型: <Badge variant="outline">{device.deviceType}</Badge></p>
            <p>序列号: {device.serialNumber}</p>
            <p>UDID: {device.udid}</p>
            <p>型号: {device.modelName || device.model}</p>
            <p>系统版本: {device.osVersion}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>MDM 状态</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p>注册状态: <Badge>{device.enrollmentStatus}</Badge></p>
            <p>MDM 已注册: {device.mdmEnrolled ? '是' : '否'}</p>
            <p>受监管: {device.supervised ? '是' : '否'}</p>
            <p>最后在线: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('zh-CN') : '-'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add device list page, detail page, and command dialog"
```

---

### Task 12: 资产管理页面

**Files:**
- Create: `frontend/src/app/(main)/assets/page.tsx`
- Create: `frontend/src/app/(main)/assets/[id]/page.tsx`
- Create: `frontend/src/app/(main)/assets/new/page.tsx`
- Create: `frontend/src/components/assets/asset-table.tsx`
- Create: `frontend/src/components/assets/asset-form.tsx`

**Step 1: 创建资产表格**

`frontend/src/components/assets/asset-table.tsx`:
```tsx
'use client';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const statusLabels: Record<string, string> = {
  in_use: '使用中', in_stock: '库存', repairing: '维修中', retired: '已退役', lost: '丢失',
};
const statusColors: Record<string, string> = {
  in_use: 'bg-green-100 text-green-800', in_stock: 'bg-blue-100 text-blue-800',
  repairing: 'bg-yellow-100 text-yellow-800', retired: 'bg-gray-100 text-gray-800',
  lost: 'bg-red-100 text-red-800',
};

export function AssetTable({ assets }: { assets: any[] }) {
  const router = useRouter();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>设备</TableHead>
          <TableHead>分配人</TableHead>
          <TableHead>部门</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>保修截止</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id} className="cursor-pointer" onClick={() => router.push(`/assets/${asset.id}`)}>
            <TableCell>{asset.device?.deviceName || asset.device?.serialNumber || '-'}</TableCell>
            <TableCell>{asset.assignedTo || '-'}</TableCell>
            <TableCell>{asset.department || '-'}</TableCell>
            <TableCell><Badge className={statusColors[asset.status]}>{statusLabels[asset.status]}</Badge></TableCell>
            <TableCell>{asset.warrantyEnd ? new Date(asset.warrantyEnd).toLocaleDateString('zh-CN') : '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Step 2: 创建资产表单**

`frontend/src/components/assets/asset-form.tsx`:
```tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const assetSchema = z.object({
  deviceId: z.string().uuid(),
  assignedTo: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.string().optional(),
  warrantyEnd: z.string().optional(),
  status: z.enum(['in_use', 'in_stock', 'repairing', 'retired', 'lost']),
  notes: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetSchema>;

export function AssetForm({ defaultValues, onSubmit }: { defaultValues?: Partial<AssetFormData>; onSubmit: (data: AssetFormData) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <Input placeholder="设备 ID" {...register('deviceId')} />
      <Input placeholder="分配人" {...register('assignedTo')} />
      <Input placeholder="部门" {...register('department')} />
      <Input placeholder="位置" {...register('location')} />
      <Input type="date" placeholder="采购日期" {...register('purchaseDate')} />
      <Input placeholder="采购价格" {...register('purchasePrice')} />
      <Input type="date" placeholder="保修截止" {...register('warrantyEnd')} />
      <select {...register('status')} className="w-full border rounded-md p-2">
        <option value="in_stock">库存</option>
        <option value="in_use">使用中</option>
        <option value="repairing">维修中</option>
        <option value="retired">已退役</option>
        <option value="lost">丢失</option>
      </select>
      <Button type="submit">保存</Button>
    </form>
  );
}
```

**Step 3: 创建资产列表页和新建页**

`frontend/src/app/(main)/assets/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { AssetTable } from '@/components/assets/asset-table';
import { Button } from '@/components/ui/button';

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  useEffect(() => { api.get('/api/assets').then((res) => setAssets(res.data.assets)); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">资产管理</h2>
        <Link href="/assets/new"><Button>新建资产</Button></Link>
      </div>
      <AssetTable assets={assets} />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add asset management pages with table and form"
```


---

## Phase 4: 高级功能

### Task 13: 审计日志模块

**Files:**
- Create: `backend/src/modules/audit/routes.ts`
- Create: `backend/src/modules/audit/service.ts`
- Create: `frontend/src/app/(dashboard)/audit-logs/page.tsx`

**Step 1: 创建审计 service**

`backend/src/modules/audit/service.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

export class AuditService {
  constructor(private prisma: PrismaClient) {}

  async log(userId: string, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}, ipAddress?: string) {
    return this.prisma.auditLog.create({
      data: { userId, action, targetType, targetId, details, ipAddress },
    });
  }

  async list(page = 1, limit = 50, filters?: { userId?: string; action?: string; targetType?: string }) {
    const where: Record<string, unknown> = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = { contains: filters.action };
    if (filters?.targetType) where.targetType = filters.targetType;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { logs, total, page, limit };
  }
}
```

**Step 2: 创建审计路由**

`backend/src/modules/audit/routes.ts`:
```typescript
import { FastifyPluginAsync } from 'fastify';
import { AuditService } from './service';
import { authenticate } from '../../middleware/authenticate';

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  const auditService = new AuditService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const { page, limit, userId, action, targetType } = request.query as any;
    return auditService.list(
      parseInt(page) || 1,
      parseInt(limit) || 50,
      { userId, action, targetType }
    );
  });
};

export default auditRoutes;
```

**Step 3: 创建审计日志前端页面**

`frontend/src/app/(dashboard)/audit-logs/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
  user: { name: string; email: string };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get(`/api/audit-logs?page=${page}&limit=50`)
      .then((res) => { setLogs(res.data.logs); setTotal(res.data.total); });
  }, [page]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">审计日志</h1>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-3 text-left">时间</th>
                <th className="p-3 text-left">操作人</th>
                <th className="p-3 text-left">操作</th>
                <th className="p-3 text-left">目标</th>
                <th className="p-3 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b">
                  <td className="p-3">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="p-3">{log.user.name}</td>
                  <td className="p-3"><Badge variant="outline">{log.action}</Badge></td>
                  <td className="p-3">{log.targetType} / {log.targetId.slice(0, 8)}</td>
                  <td className="p-3 text-muted-foreground">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">共 {total} 条记录</span>
        <div className="space-x-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</button>
          <span>第 {page} 页</span>
          <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 50}>下一页</button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add audit log module with backend service and frontend page"
```

---

### Task 14: 报表模块

**Files:**
- Create: `backend/src/modules/reports/routes.ts`
- Create: `backend/src/modules/reports/service.ts`
- Create: `frontend/src/app/(dashboard)/reports/page.tsx`

**Step 1: 创建报表 service**

`backend/src/modules/reports/service.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  async deviceStats() {
    const [byType, byStatus, byOS, total] = await Promise.all([
      this.prisma.device.groupBy({ by: ['deviceType'], _count: true }),
      this.prisma.device.groupBy({ by: ['enrollmentStatus'], _count: true }),
      this.prisma.device.groupBy({ by: ['osVersion'], _count: true, orderBy: { _count: { osVersion: 'desc' } }, take: 10 }),
      this.prisma.device.count(),
    ]);
    return { byType, byStatus, byOS, total };
  }

  async assetStats() {
    const [byStatus, byDepartment, total] = await Promise.all([
      this.prisma.asset.groupBy({ by: ['status'], _count: true }),
      this.prisma.asset.groupBy({ by: ['department'], _count: true, orderBy: { _count: { department: 'desc' } }, take: 10 }),
      this.prisma.asset.count(),
    ]);
    return { byStatus, byDepartment, total };
  }

  async complianceReport() {
    const [enrolled, supervised, total] = await Promise.all([
      this.prisma.device.count({ where: { mdmEnrolled: true } }),
      this.prisma.device.count({ where: { supervised: true } }),
      this.prisma.device.count(),
    ]);
    return {
      total,
      enrolled,
      unenrolled: total - enrolled,
      supervised,
      unsupervised: total - supervised,
      enrollmentRate: total > 0 ? (enrolled / total * 100).toFixed(1) : '0',
      supervisionRate: total > 0 ? (supervised / total * 100).toFixed(1) : '0',
    };
  }
}
```

**Step 2: 创建报表路由**

`backend/src/modules/reports/routes.ts`:
```typescript
import { FastifyPluginAsync } from 'fastify';
import { ReportService } from './service';
import { authenticate } from '../../middleware/authenticate';

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  const reportService = new ReportService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/devices', async () => reportService.deviceStats());
  fastify.get('/assets', async () => reportService.assetStats());
  fastify.get('/compliance', async () => reportService.complianceReport());
};

export default reportRoutes;
```

**Step 3: 创建报表前端页面**

`frontend/src/app/(dashboard)/reports/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function ReportsPage() {
  const [deviceStats, setDeviceStats] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/reports/devices'),
      api.get('/api/reports/compliance'),
    ]).then(([d, c]) => {
      setDeviceStats(d.data);
      setCompliance(c.data);
    });
  }, []);

  if (!deviceStats || !compliance) return <div>加载中...</div>;

  const typeData = deviceStats.byType.map((d: any) => ({ name: d.deviceType, value: d._count }));
  const statusData = deviceStats.byStatus.map((d: any) => ({ name: d.enrollmentStatus, value: d._count }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">报表中心</h1>

      {/* 合规概览 */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{compliance.total}</div><p className="text-sm text-muted-foreground">设备总数</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{compliance.enrollmentRate}%</div><p className="text-sm text-muted-foreground">注册率</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{compliance.supervisionRate}%</div><p className="text-sm text-muted-foreground">监管率</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{compliance.unenrolled}</div><p className="text-sm text-muted-foreground">未注册设备</p></CardContent></Card>
      </div>

      {/* 图表 */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>设备类型分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {typeData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>注册状态分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusData}>
                <XAxis dataKey="name" /><YAxis /><Tooltip />
                <Bar dataKey="value" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add reports module with device stats, asset stats, and compliance report"
```

---

## Phase 5: 部署和收尾

### Task 15: Docker 化和部署配置

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Modify: `docker-compose.yml` — 添加 backend 和 frontend 服务

**Step 1: 创建后端 Dockerfile**

`backend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

**Step 2: 创建前端 Dockerfile**

`frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**Step 3: 更新 docker-compose.yml**

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: mydevices
      POSTGRES_PASSWORD: mydevices_dev
      POSTGRES_DB: mydevices
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://mydevices:mydevices_dev@postgres:5432/mydevices
      REDIS_URL: redis://redis:6379
      JWT_SECRET: change-me-in-production
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    depends_on:
      - backend

volumes:
  pgdata:
  redisdata:
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Docker configuration for backend, frontend, and full stack deployment"
```

---

### Task 16: README 和项目文档

**Files:**
- Create: `README.md`

**Step 1: 编写 README**

包含：项目简介、技术栈、快速开始（docker-compose up）、开发环境搭建、项目结构说明、API 文档链接。

**Step 2: Final commit**

```bash
git add -A
git commit -m "docs: add README with project overview, setup guide, and architecture docs"
```

---

## 任务总览

| Phase | Task | 描述 | 预估复杂度 |
|-------|------|------|-----------|
| 1 | Task 1 | 初始化 monorepo 和基础配置 | 低 |
| 1 | Task 2 | Prisma Schema 和数据库迁移 | 中 |
| 2 | Task 3 | Fastify 应用入口和插件 | 中 |
| 2 | Task 4 | 认证模块 | 中 |
| 2 | Task 5 | 设备管理模块 | 中 |
| 2 | Task 6 | 资产管理模块 | 中 |
| 2 | Task 7 | MDM 协议模块 | 高 |
| 3 | Task 8 | 前端基础布局 | 中 |
| 3 | Task 9 | 登录页面 | 低 |
| 3 | Task 10 | Dashboard 仪表盘 | 中 |
| 3 | Task 11 | 设备管理页面 | 高 |
| 3 | Task 12 | 资产管理页面 | 中 |
| 4 | Task 13 | 审计日志模块 | 中 |
| 4 | Task 14 | 报表模块 | 中 |
| 5 | Task 15 | Docker 化和部署 | 低 |
| 5 | Task 16 | README 和文档 | 低 |

---

## Phase 5: 部署与收尾

### Task 16: Docker 化部署

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Modify: `docker-compose.yml`

**Step 1: 创建后端 Dockerfile**

`backend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

**Step 2: 创建前端 Dockerfile**

`frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**Step 3: 更新 docker-compose.yml 为完整版**

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: mydevices
      POSTGRES_PASSWORD: mydevices_dev
      POSTGRES_DB: mydevices
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mydevices"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://mydevices:mydevices_dev@postgres:5432/mydevices
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3001
    depends_on:
      - backend

volumes:
  pgdata:
  redisdata:
```

**Step 4: 添加 backend/package.json scripts**

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset"
  }
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Docker configuration for full-stack deployment"
```

---

### Task 17: README 和项目文档

**Files:**
- Create: `README.md`

**Step 1: 编写 README**

`README.md`:
```markdown
# myDevices — Apple 设备管理系统

企业级 Apple 设备管理系统，集成 MDM 协议和资产管理功能。

## 功能特性

- **设备管理** — 支持 iPhone、iPad、Mac、Apple TV、Apple Watch、Apple Vision Pro
- **MDM 协议** — 设备注册、命令下发、配置描述文件管理、声明式管理 (DDM)
- **资产管理** — 设备台账、采购追踪、分配记录、生命周期管理
- **审计日志** — 完整操作记录、合规审计
- **报表中心** — 设备统计、资产报表、合规报告
- **RBAC** — 超级管理员、设备管理员、只读用户

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端 | Next.js 14 + shadcn/ui + Tailwind CSS |
| 后端 | Fastify + TypeScript + Prisma |
| 数据库 | PostgreSQL + Redis |
| 部署 | Docker Compose |

## 快速开始

### 前置条件

- Node.js 20+
- Docker & Docker Compose

### 开发环境

1. 启动数据库
   ```bash
   docker compose up postgres redis -d
   ```

2. 后端
   ```bash
   cd backend
   cp ../.env.example .env
   npm install
   npx prisma migrate dev
   npm run db:seed
   npm run dev
   ```

3. 前端
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. 访问 http://localhost:3000

### 生产部署

```bash
docker compose up -d --build
```

## 默认账号

| 邮箱 | 密码 | 角色 |
|------|------|------|
| admin@mydevices.com | admin123 | 超级管理员 |
```

**Step 2: Final commit**

```bash
git add -A
git commit -m "docs: add README and project documentation"
```

---

## 任务总览

| Phase | Task | 描述 | 预估 |
|-------|------|------|------|
| 1 | Task 1 | 初始化 monorepo 和基础配置 | - |
| 1 | Task 2 | Prisma Schema 和数据库迁移 | - |
| 2 | Task 3 | Fastify 应用入口和插件配置 | - |
| 2 | Task 4 | 认证模块 (auth) | - |
| 2 | Task 5 | 设备管理模块 (devices) | - |
| 2 | Task 6 | 资产管理模块 (assets) | - |
| 2 | Task 7 | MDM 协议模块 | - |
| 3 | Task 8 | 前端基础布局 | - |
| 3 | Task 9 | 登录页面 | - |
| 3 | Task 10 | Dashboard 仪表盘 | - |
| 3 | Task 11 | 设备管理页面 | - |
| 3 | Task 12 | 资产管理页面 | - |
| 4 | Task 13 | 审计日志模块 | - |
| 4 | Task 14 | 报表模块 | - |
| 4 | Task 15 | 配置描述文件管理 | - |
| 5 | Task 16 | Docker 化部署 | - |
| 5 | Task 17 | README 和项目文档 | - |
