# myDevices 综合升级 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**设计文档**: `docs/plans/2026-03-01-comprehensive-upgrade-design.md`
**日期**: 2026-03-01
**目标**: 全面升级 myDevices MDM 系统 — Bug 修复、核心流程闭环、扩展功能、MDM 标准功能、重新部署

---

## 任务依赖图

```
Phase 1 (Database & Seed)
  ├─→ Phase 2 (Bug Fixes) — 可并行
  ├─→ Phase 3 (Core Admin Flow) — 依赖 Phase 1
  │     └─→ Phase 4 (Extended Features) — 依赖 Phase 1+3
  ├─→ Phase 5 (MDM Features) — 依赖 Phase 1
  └─→ Phase 6 (i18n + Deployment) — 依赖全部
```

---

## Phase 1: 数据库 & 基础设施

### Task 1.1 — Prisma Schema: 新增 7 个模型 + 修改关系

**文件**: `backend/prisma/schema.prisma`

**步骤 A** — 在文件末尾 (L244 后) 添加 7 个新模型:

```prisma
model SystemSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("system_settings")
}

model AssetHistory {
  id         String   @id @default(uuid())
  assetId    String   @map("asset_id")
  action     String
  fromUserId String?  @map("from_user_id")
  toUserId   String?  @map("to_user_id")
  fromStatus String?  @map("from_status")
  toStatus   String?  @map("to_status")
  details    Json?
  createdAt  DateTime @default(now()) @map("created_at")
  asset      Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  @@index([assetId])
  @@map("asset_histories")
}

model MaintenanceRecord {
  id        String    @id @default(uuid())
  assetId   String    @map("asset_id")
  reason    String
  vendor    String?
  cost      Decimal?  @db.Decimal(10, 2)
  startDate DateTime  @map("start_date")
  endDate   DateTime? @map("end_date")
  notes     String?
  createdAt DateTime  @default(now()) @map("created_at")
  asset     Asset     @relation(fields: [assetId], references: [id], onDelete: Cascade)
  @@index([assetId])
  @@map("maintenance_records")
}

model App {
  id         String          @id @default(uuid())
  bundleId   String          @unique @map("bundle_id")
  name       String
  version    String?
  icon       String?
  size       BigInt?
  category   String?
  managedApp Boolean         @default(true) @map("managed_app")
  source     String?
  createdAt  DateTime        @default(now()) @map("created_at")
  updatedAt  DateTime        @updatedAt @map("updated_at")
  assignments AppAssignment[]
  @@map("apps")
}

model AppAssignment {
  id           String      @id @default(uuid())
  appId        String      @map("app_id")
  deviceId     String?     @map("device_id")
  departmentId String?     @map("department_id")
  status       String      @default("pending")
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
  app          App         @relation(fields: [appId], references: [id], onDelete: Cascade)
  device       Device?     @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  department   Department? @relation(fields: [departmentId], references: [id])
  @@index([appId])
  @@index([deviceId])
  @@map("app_assignments")
}

model Content {
  id          String              @id @default(uuid())
  name        String
  type        String
  fileUrl     String?             @map("file_url")
  fileSize    BigInt?             @map("file_size")
  description String?
  version     String?
  createdAt   DateTime            @default(now()) @map("created_at")
  updatedAt   DateTime            @updatedAt @map("updated_at")
  assignments ContentAssignment[]
  @@map("contents")
}

model ContentAssignment {
  id           String      @id @default(uuid())
  contentId    String      @map("content_id")
  deviceId     String?     @map("device_id")
  departmentId String?     @map("department_id")
  status       String      @default("pending")
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
  content      Content     @relation(fields: [contentId], references: [id], onDelete: Cascade)
  device       Device?     @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  department   Department? @relation(fields: [departmentId], references: [id])
  @@index([contentId])
  @@index([deviceId])
  @@map("content_assignments")
}
```

**步骤 B** — 修改现有模型关系:

- `Asset` 模型 (L99-L117): 在 `assignedUser` 行后添加:
  ```prisma
  histories          AssetHistory[]
  maintenanceRecords MaintenanceRecord[]
  ```
- `Device` 模型 (L67-L97): 在 `profiles DeviceProfile[]` 行后添加:
  ```prisma
  appAssignments     AppAssignment[]
  contentAssignments ContentAssignment[]
  ```
- `Department` 模型 (L162-L176): 在 `assets Asset[]` 行后添加:
  ```prisma
  appAssignments     AppAssignment[]
  contentAssignments ContentAssignment[]
  ```

**验证**: `cd backend && npx prisma validate`
**提交**: `feat(db): add 7 new models for lifecycle, apps, content, settings`

---

### Task 1.2 — 运行数据库迁移

```bash
cd backend && npx prisma migrate dev --name comprehensive-upgrade
```

**提交**: `feat(db): run comprehensive-upgrade migration`

---

### Task 1.3 — 修复权限种子数据

**文件**: `backend/prisma/seed.ts`

**步骤 A** — PERMISSIONS 数组 (L86-L109): 在 L108 `settings:write` 之后追加:

```typescript
  { code: 'mdm:command', name: '执行 MDM 命令', module: 'mdm', sortOrder: 23 },
  { code: 'profile:deploy', name: '部署配置文件', module: 'profile', sortOrder: 24 },
  { code: 'dashboard:view', name: '查看仪表盘', module: 'dashboard', sortOrder: 25 },
  { code: 'app:read', name: '查看应用', module: 'app', sortOrder: 26 },
  { code: 'app:write', name: '编辑应用', module: 'app', sortOrder: 27 },
  { code: 'app:deploy', name: '部署应用', module: 'app', sortOrder: 28 },
  { code: 'content:read', name: '查看内容', module: 'content', sortOrder: 29 },
  { code: 'content:write', name: '编辑内容', module: 'content', sortOrder: 30 },
  { code: 'content:deploy', name: '分发内容', module: 'content', sortOrder: 31 },
```

**步骤 B** — ROLES `device_admin` (L120-L125): 追加权限:
```typescript
'mdm:command', 'profile:deploy', 'dashboard:view',
'app:read', 'app:write', 'app:deploy', 'content:read',
```

**步骤 C** — ROLES `readonly` (L130-L133): 追加:
```typescript
'dashboard:view', 'app:read', 'content:read',
```

**验证**: `cd backend && npx prisma db seed`
**提交**: `fix(seed): add missing + new module permissions`


---

## Phase 2: Bug 修复 & 代码质量

### Task 2.1 — 审计路由添加权限检查

**文件**: `backend/src/modules/audit/routes.ts` (17 行)

L10 的 `fastify.get('/')` 添加 preHandler:

```typescript
// 修改前 (L10):
fastify.get('/', async (request) => {

// 修改后:
fastify.get('/', { preHandler: [requirePermission('audit:read')] }, async (request) => {
```

同时在 L4 添加 import:
```typescript
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
```

**提交**: `fix(audit): add audit:read permission check`

---

### Task 2.2 — MDM 命令类型枚举校验

**文件**: `backend/src/modules/devices/routes.ts` L59-L78

修改 L66 的 commandType schema:

```typescript
// 修改前:
commandType: { type: 'string', minLength: 1 },

// 修改后:
commandType: {
  type: 'string',
  enum: [
    'DeviceInformation', 'SecurityInfo', 'InstalledApplicationList',
    'DeviceLock', 'EraseDevice', 'ClearPasscode',
    'InstallProfile', 'RemoveProfile',
    'InstallApplication', 'RemoveApplication', 'InstallMedia',
    'RestartDevice', 'ShutDownDevice',
  ],
},
```

**提交**: `fix(security): validate MDM command types with enum`

---

### Task 2.3 — Asset 创建表单补充状态 + Notes 改 textarea

**文件**: `frontend/src/app/(dashboard)/assets/new/page.tsx`

**步骤 A** — L129-L133 状态 select 补充 `retired` 和 `lost`:

```tsx
<select value={form.status} onChange={e => update('status', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
  <option value="in_stock">{t('assetStatus.in_stock')}</option>
  <option value="in_use">{t('assetStatus.in_use')}</option>
  <option value="repairing">{t('assetStatus.repairing')}</option>
  <option value="retired">{t('assetStatus.retired')}</option>
  <option value="lost">{t('assetStatus.lost')}</option>
</select>
```

**步骤 B** — L138 Notes 字段改为 textarea:

```tsx
// 修改前:
<Input value={form.notes} onChange={e => update('notes', e.target.value)} />

// 修改后:
<textarea value={form.notes} onChange={e => update('notes', e.target.value)}
  className="w-full border rounded-md px-3 py-2 text-sm bg-background min-h-[80px] resize-y" />
```

**步骤 C** — 所有 `<select>` 添加 `bg-background` class (dark mode 支持):
- L98: `className="w-full border rounded-md px-3 py-2 text-sm bg-background"`
- L113: 同上

**提交**: `fix(ui): add missing asset statuses, textarea for notes, dark mode selects`

---

### Task 2.4 — 资产详情页货币格式化

**文件**: `frontend/src/app/(dashboard)/assets/[id]/page.tsx`

L106 硬编码 `¥` 替换:

```tsx
// 修改前:
{asset.purchasePrice ? `¥${asset.purchasePrice}` : '-'}

// 修改后:
{asset.purchasePrice
  ? new Intl.NumberFormat(i18n.language === 'zh' ? 'zh-CN' : 'en-US', { style: 'currency', currency: 'CNY' }).format(Number(asset.purchasePrice))
  : '-'}
```

确保顶部有 `const { t, i18n } = useTranslation();`

**提交**: `fix(ui): use Intl.NumberFormat for currency display`

---

### Task 2.5 — label 关联 htmlFor/id

**文件**: `frontend/src/app/(dashboard)/assets/new/page.tsx`

所有 `<label>` 添加 `htmlFor`，对应 `<Input>` / `<select>` / `<textarea>` 添加 `id`:

```tsx
<label htmlFor="deviceId" className="text-sm font-medium">{t('assets.deviceId')}</label>
<Input id="deviceId" ... />
```

对以下字段执行: deviceId, purchaseDate, purchasePrice, warrantyEnd, departmentId, assignedToId, location, status, notes

**提交**: `fix(a11y): associate labels with form controls`

---

### Task 2.6 — Settings 页面 SMTP 硬编码中文替换为 i18n

**文件**: `frontend/src/app/(dashboard)/settings/page.tsx` L661-L699

替换所有硬编码中文字符串:

```tsx
// L663: '邮件服务器配置 (SMTP)' → t('smtp.title')
// L667: 'SMTP 主机' → t('smtp.host')
// L671: '端口' → t('smtp.port')
// L675: '用户名' → t('smtp.user')
// L679: '密码' → t('smtp.password')
// L683: '发件人地址' → t('smtp.from')
// L687: 'SSL/TLS' → t('smtp.secure')
// L690: '启用安全连接' → t('smtp.secure')
```

同时修复 L27-L30 的 fallback 硬编码:
```tsx
// L27: t('settings.departmentManagement') || '部门管理' → t('settings.departmentManagement')
// L28: t('settings.roleManagement') || '角色管理' → t('settings.roleManagement')
// L30: t('settings.smtpConfig') || '邮件配置' → t('settings.smtpConfig')
```

**提交**: `fix(i18n): replace hardcoded Chinese in settings page`


---

### Task 2.7 — Settings 页面其余硬编码中文替换

**文件**: `frontend/src/app/(dashboard)/settings/page.tsx`

**UserManagement 函数** (L45-L204):
```
L98:  '重置密码失败' → t('settings.resetPasswordFailed')
L117: '部门（可选）' → t('users.noDepartment')
L135: '部门' → t('users.department')
L168: '无部门' → t('users.noDepartment')
L194: '密码已重置' → t('settings.resetPassword')
L196: '新密码（请妥善保管）：' → t('settings.resetPasswordResult')
```

**DepartmentManagement 函数** (L209-L367):
```
L238: '创建失败' → t('settings.createFailed')
L247: '更新失败' → t('settings.editFailed')
L252: '删除失败' → t('settings.deleteFailed')
L266: '人' 改为 t('departments.userCount', { count: ... })
L280: '部门管理' → t('departments.title')
L281: '添加部门' → t('departments.add')
L286: '暂无部门' → t('departments.empty')
L293: '添加部门' → t('departments.add')
L296: '部门名称' → t('departments.name')
L300: '部门编码' → t('departments.code')
L304: '上级部门' → t('departments.parent')
L306: '无（顶级部门）' → t('departments.none')
L311: '排序' → t('departments.sortOrder')
L325: '编辑部门' → t('departments.edit')
L328: '部门名称' → t('departments.name')
L332: '部门编码' → t('departments.code')
L336: '上级部门' → t('departments.parent')
L338: '无（顶级部门）' → t('departments.none')
L343: '排序' → t('departments.sortOrder')
L358: '确定要删除此部门吗？' → t('departments.deleteConfirm')
```

**RoleManagement 函数** (L372-L569):
```
L389-394: DATA_SCOPES labels 改为 t() 调用:
  { value: 'all', label: t('roles.dataScope.all') },
  { value: 'department_and_children', label: t('roles.dataScope.department_and_children') },
  { value: 'department', label: t('roles.dataScope.department') },
  { value: 'self', label: t('roles.dataScope.self') },

L428: '创建失败' → t('settings.createFailed')
L437: '更新失败' → t('settings.editFailed')
L442: '删除失败' → t('settings.deleteFailed')
L449: '角色管理' → t('roles.title')
L450: '添加角色' → t('roles.add')
L458: '名称' → t('roles.name')
L459: '编码' → t('roles.code')
L460: '数据范围' → t('roles.dataScope')
L461: '用户数' → t('roles.userCount')
L468: '系统' → t('roles.builtIn')
L486: '添加角色' → t('roles.add')
L490: '角色名称' → t('roles.name')
L494: '角色编码' → t('roles.code')
L499: '描述' → t('roles.description')
L503: '数据范围' → t('roles.dataScope')
L509: '权限' → t('roles.permissions')
L523: '编辑角色' → t('roles.edit')
L527: '角色名称' → t('roles.name')
L531: '角色编码' → t('roles.code')
L537: '描述' → t('roles.description')
L541: '数据范围' → t('roles.dataScope')
L546: '权限' → t('roles.permissions')
L561: '确定要删除此角色吗？' → t('roles.deleteConfirm')
```

注意: DATA_SCOPES 常量使用了 t()，需移入组件函数内部（不能在模块顶层调用 t()）。

**提交**: `fix(i18n): replace all hardcoded Chinese in settings page`

---

### Task 2.8 — 错误处理统一化

**文件**: 以下每个路由文件的 handler 添加 try/catch

**A** — `backend/src/modules/assets/routes.ts` L19-L22 (GET /:id):
```typescript
fastify.get('/:id', { preHandler: [requirePermission('asset:read')] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    return await assetService.getById(id);
  } catch (err: any) {
    if (err.code === 'P2025' || err.name === 'NotFoundError') {
      return reply.status(404).send({ error: 'Asset not found', code: 404 });
    }
    request.log.error(err);
    return reply.status(500).send({ error: 'Internal server error', code: 500 });
  }
});
```

**B** — 同样模式应用于:
- `devices/routes.ts` GET /:id (L31-L34)
- `profiles/routes.ts` GET /:id
- POST/PUT/DELETE 端点: catch + 统一格式 `{ error, code }`

**C** — 添加 `reply` 参数到所有缺少它的 handler 签名

**提交**: `fix: unified try/catch error handling across all routes`

---

### Task 2.9 — 消除 `as any` 类型标注

**文件**: `backend/src/modules/assets/routes.ts`

L11 和 L44 的 `as any` 替换为类型接口:

```typescript
interface AssetListQuery {
  page?: string; limit?: string; status?: string;
  departmentId?: string; search?: string; sortBy?: string; sortOrder?: string;
}

interface AssetCreateBody {
  deviceId: string; purchaseDate?: string; purchasePrice?: number;
  warrantyEnd?: string; assignedToId?: string; departmentId?: string;
  location?: string; status?: string; notes?: string;
}

// L11: const { page, limit, ... } = request.query as AssetListQuery;
// L44: const data = request.body as AssetCreateBody;
```

同样处理:
- `devices/routes.ts` L21 `request.query as any`, L38 `request.body as any`
- `audit/routes.ts` L11 `request.query as any`

**提交**: `fix: replace as-any with typed interfaces`

---

### Task 2.10 — select 暗色模式修复

**文件**: 所有使用 `<select>` 的前端页面

为每个 `<select>` 的 className 添加 `bg-background text-foreground`:

涉及文件:
- `assets/new/page.tsx` L98, L110, L129 (3处)
- `assets/[id]/page.tsx` 的 status/department/assignedTo select
- `settings/page.tsx` L112, L116, L164, L167, L305, L337, L504, L541 (~8处)
- `departments/page.tsx` 的 select
- `roles/page.tsx` 的 select

**提交**: `fix(ui): add dark mode styles to all select elements`


---

## Phase 3: 核心管理员流程

### Task 3.1 — SystemSetting 服务 + DB-backed SMTP

**新建文件**: `backend/src/services/system-setting.ts`

```typescript
import { PrismaClient } from '@prisma/client';

export class SystemSettingService {
  constructor(private prisma: PrismaClient) {}

  async get(key: string): Promise<string | null> {
    const s = await this.prisma.systemSetting.findUnique({ where: { key } });
    return s?.value ?? null;
  }

  async getMany(prefix: string): Promise<Record<string, string>> {
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: prefix } },
    });
    return Object.fromEntries(settings.map(s => [s.key, s.value]));
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async setMany(entries: Record<string, string>): Promise<void> {
    await this.prisma.$transaction(
      Object.entries(entries).map(([key, value]) =>
        this.prisma.systemSetting.upsert({
          where: { key }, update: { value }, create: { key, value },
        })
      )
    );
  }
}
```

**修改文件**: `backend/src/services/mail.ts` (L1-L39 全量重写)

改为从 DB 读取 SMTP 配置 (fallback 到 process.env):

```typescript
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

let transporter: nodemailer.Transporter | null = null;
let prismaRef: PrismaClient | null = null;

export function initMail(prisma: PrismaClient) { prismaRef = prisma; }

async function getSmtpConfig() {
  if (prismaRef) {
    try {
      const settings = await prismaRef.systemSetting.findMany({
        where: { key: { startsWith: 'smtp.' } },
      });
      const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
      if (map['smtp.host']) return map;
    } catch { /* fallback */ }
  }
  return {
    'smtp.host': process.env.SMTP_HOST || '',
    'smtp.port': process.env.SMTP_PORT || '587',
    'smtp.user': process.env.SMTP_USER || '',
    'smtp.pass': process.env.SMTP_PASS || '',
    'smtp.from': process.env.SMTP_FROM || '',
    'smtp.secure': process.env.SMTP_SECURE || 'false',
  };
}

async function getTransporter() {
  const cfg = await getSmtpConfig();
  if (!cfg['smtp.host']) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg['smtp.host'],
      port: parseInt(cfg['smtp.port'] || '587'),
      secure: cfg['smtp.secure'] === 'true',
      auth: { user: cfg['smtp.user'], pass: cfg['smtp.pass'] },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const t = await getTransporter();
  if (!t) return false;
  const cfg = await getSmtpConfig();
  try {
    await t.sendMail({ from: cfg['smtp.from'] || cfg['smtp.user'], to, subject, html });
    return true;
  } catch (err) {
    console.error('Failed to send email:', err);
    return false;
  }
}

export function resetTransporter() { transporter = null; }
```

**修改文件**: `backend/src/app.ts`

1. 在 buildApp() 顶部 (L22 之后) 添加 mail 初始化:
```typescript
import { initMail } from './services/mail.js';
// 在 prismaPlugin 注册后:
initMail(app.prisma);
```

2. L107-L145 SMTP 设置端点改为读写 DB:
```typescript
app.get('/api/settings/smtp', { preHandler: [requirePermission('settings:read')] }, async () => {
  const settingService = new SystemSettingService(app.prisma);
  const cfg = await settingService.getMany('smtp.');
  return {
    host: cfg['smtp.host'] || '', port: cfg['smtp.port'] || '587',
    user: cfg['smtp.user'] || '', from: cfg['smtp.from'] || '',
    secure: cfg['smtp.secure'] || 'false',
  };
});

app.put('/api/settings/smtp', { preHandler: [requirePermission('settings:write')] }, async (request) => {
  const body = request.body as Record<string, string>;
  const settingService = new SystemSettingService(app.prisma);
  const mapping: Record<string, string> = {
    host: 'smtp.host', port: 'smtp.port', user: 'smtp.user',
    pass: 'smtp.pass', from: 'smtp.from', secure: 'smtp.secure',
  };
  const entries: Record<string, string> = {};
  for (const [key, dbKey] of Object.entries(mapping)) {
    if (body[key] !== undefined) entries[dbKey] = body[key];
  }
  await settingService.setMany(entries);
  resetTransporter();
  return { message: 'SMTP settings updated' };
});
```

3. 删除所有 `readFileSync` / `writeFileSync` 对 .env 的操作 (L83-L105 APNs 部分也改为 DB)

4. 添加测试邮件端点:
```typescript
app.post('/api/settings/smtp/test', { preHandler: [requirePermission('settings:write')] }, async (request) => {
  const user = request.user as { id: string; email: string };
  const { sendEmail } = await import('./services/mail.js');
  const ok = await sendEmail(user.email, 'myDevices 测试邮件', '<p>这是一封测试邮件，如果您收到了说明 SMTP 配置正确。</p>');
  if (ok) return { message: 'Test email sent' };
  return { error: 'Failed to send test email', code: 500 };
});
```

**提交**: `feat: DB-backed SMTP settings with test email endpoint`

---

### Task 3.2 — 设备搜索 API + DevicePicker 组件

**文件**: `backend/src/modules/devices/routes.ts`

在 L20 `fastify.get('/')` 之前添加搜索路由:

```typescript
fastify.get('/search', { preHandler: [requirePermission('device:read')] }, async (request) => {
  const { q } = request.query as { q?: string };
  if (!q || q.length < 2) return { devices: [] };
  const devices = await fastify.prisma.device.findMany({
    where: {
      asset: null,
      OR: [
        { deviceName: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { modelName: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, deviceName: true, serialNumber: true, modelName: true, deviceType: true },
    take: 20,
  });
  return { devices };
});
```

**新建文件**: `frontend/src/components/device-picker.tsx`

使用 Popover + Command (shadcn/ui) 构建 Combobox:
- Props: `value: string`, `onChange: (deviceId: string) => void`
- 输入文字 → debounce 300ms → `GET /api/devices/search?q=xxx`
- 显示: 设备名 + 序列号 + 型号
- 选中后设置 deviceId 值

**修改文件**: `frontend/src/app/(dashboard)/assets/new/page.tsx` L74-L77

```tsx
// 修改前:
<Input value={form.deviceId} onChange={e => update('deviceId', e.target.value)} ... />

// 修改后:
<DevicePicker value={form.deviceId} onChange={(id) => update('deviceId', id)} />
```

**提交**: `feat: device search API and DevicePicker combobox component`

---

### Task 3.3 — 邮件模板系统

**新建文件**: `backend/src/services/email-templates.ts`

```typescript
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapLayout(body: string): string {
  return `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
    <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin-bottom:20px">
      <h1 style="margin:0;font-size:18px;color:#333">myDevices MDM</h1>
    </div>
    ${body}
    <div style="border-top:1px solid #eee;padding-top:12px;margin-top:24px;font-size:12px;color:#999">
      此邮件由 myDevices 系统自动发送，请勿回复。
    </div>
  </div>`;
}

export const emailTemplates = {
  assetAssigned(vars: { userName: string; deviceName: string; serialNumber: string }) {
    return {
      subject: `资产分配通知 - ${vars.deviceName}`,
      html: wrapLayout(`
        <h2>资产分配通知</h2>
        <p>您好 ${escapeHtml(vars.userName)}，</p>
        <p>以下设备已分配给您：</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>设备</strong></td>
              <td style="padding:8px;border:1px solid #ddd">${escapeHtml(vars.deviceName)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>序列号</strong></td>
              <td style="padding:8px;border:1px solid #ddd">${escapeHtml(vars.serialNumber)}</td></tr>
        </table>
      `),
    };
  },

  welcome(vars: { userName: string; email: string; password: string }) {
    return {
      subject: `欢迎加入 myDevices`,
      html: wrapLayout(`
        <h2>欢迎加入</h2>
        <p>您好 ${escapeHtml(vars.userName)}，您的账号已创建。</p>
        <p><strong>邮箱:</strong> ${escapeHtml(vars.email)}</p>
        <p><strong>初始密码:</strong> <code>${escapeHtml(vars.password)}</code></p>
        <p>请登录后立即修改密码。</p>
      `),
    };
  },

  mdmCommandAlert(vars: { userName: string; deviceName: string; commandType: string }) {
    return {
      subject: `MDM 命令通知 - ${vars.commandType}`,
      html: wrapLayout(`
        <h2>MDM 命令执行通知</h2>
        <p>您好 ${escapeHtml(vars.userName)}，</p>
        <p>以下命令已在您的设备上执行：</p>
        <p><strong>设备:</strong> ${escapeHtml(vars.deviceName)}</p>
        <p><strong>命令:</strong> ${escapeHtml(vars.commandType)}</p>
      `),
    };
  },

  assetStatusChanged(vars: { userName: string; deviceName: string; oldStatus: string; newStatus: string }) {
    return {
      subject: `资产状态变更 - ${vars.deviceName}`,
      html: wrapLayout(`
        <h2>资产状态变更通知</h2>
        <p>您好 ${escapeHtml(vars.userName)}，</p>
        <p>您的设备状态已变更：</p>
        <p><strong>${escapeHtml(vars.oldStatus)}</strong> → <strong>${escapeHtml(vars.newStatus)}</strong></p>
      `),
    };
  },
};
```

**提交**: `feat: HTML email template system with XSS protection`

---

### Task 3.4 — 通知触发点接线

**文件**: `backend/src/modules/assets/service.ts`

**A** — 修改 `create()` L56-L87: 使用邮件模板
```typescript
if (data.assignedToId) {
  const notifService = new NotificationService(this.prisma);
  const tmpl = emailTemplates.assetAssigned({
    userName: asset.assignedUser?.name || '',
    deviceName: asset.device?.deviceName || asset.device?.serialNumber || '',
    serialNumber: asset.device?.serialNumber || '',
  });
  await notifService.createAndEmail(data.assignedToId, tmpl.subject, tmpl.html, 'asset_assigned');
}
```

**B** — 修改 `update()` L90-L116: 检测分配变更 + 状态变更
```typescript
// 在更新前获取旧数据
const oldAsset = await this.prisma.asset.findUnique({
  where: { id }, select: { assignedToId: true, status: true },
});

// 更新后...
// 1. 分配变更通知
if (data.assignedToId && data.assignedToId !== oldAsset?.assignedToId) {
  // 通知新分配用户
}

// 2. 状态变更为 lost/retired 通知原用户
if (['lost', 'retired'].includes(data.status || '') && oldAsset?.assignedToId) {
  // 通知原分配用户
}
```

**文件**: `backend/src/modules/auth/routes.ts`
用户创建成功后发送欢迎邮件 (在 register 端点的 return 之前):
```typescript
await notifService.createAndEmail(user.id, tmpl.subject, tmpl.html, 'welcome');
```

**文件**: `backend/src/modules/devices/routes.ts` L59-L78
MDM 关键命令发送后通知 (在 `POST /:id/commands` handler 中):
```typescript
const criticalCommands = ['DeviceLock', 'EraseDevice', 'ClearPasscode'];
if (criticalCommands.includes(commandType)) {
  // 查找设备关联资产的 assignedToId → 通知该用户
}
```

**提交**: `feat: wire notification triggers for asset, user, MDM events`

---

### Task 3.5 — Settings 前端添加测试邮件按钮

**文件**: `frontend/src/app/(dashboard)/settings/page.tsx` SmtpSettings 函数

在 L695 保存按钮旁添加:
```tsx
<Button variant="outline" onClick={async () => {
  try {
    await api.post('/api/settings/smtp/test');
    setMsg(t('common.testEmailSuccess'));
  } catch { setMsg(t('common.testEmailFailed')); }
}} disabled={saving}>
  <Mail className="h-4 w-4 mr-2" />{t('common.testEmail')}
</Button>
```

**提交**: `feat: add test email button to SMTP settings`


---

## Phase 4: 扩展功能

### Task 4.1 — 批量操作 (后端)

**新建文件**: `backend/src/modules/assets/batch-routes.ts`

```typescript
import { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../middleware/authenticate.js';

const batchRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /batch-assign — 批量分配
  fastify.post('/batch-assign', { preHandler: [requirePermission('asset:write')] }, async (request, reply) => {
    const { assetIds, assignedToId, departmentId } = request.body as {
      assetIds: string[]; assignedToId?: string; departmentId?: string;
    };
    // 逐个更新 + 触发通知 + 记录审计
    // 返回 { updated: number }
  });

  // POST /batch-status — 批量状态变更
  fastify.post('/batch-status', { preHandler: [requirePermission('asset:write')] }, async (request, reply) => {
    const { assetIds, status } = request.body as { assetIds: string[]; status: string };
    // 批量更新状态 + 触发通知 + 记录审计
  });

  // POST /import — CSV 导入
  fastify.post('/import', { preHandler: [requirePermission('asset:write')] }, async (request, reply) => {
    // 接收 JSON 数据 (前端解析 CSV 后传入)
    const { records } = request.body as { records: any[] };
    // 逐条验证 + 创建
  });
};

export default batchRoutes;
```

**文件**: `backend/src/app.ts` 注册路由:
```typescript
import assetBatchRoutes from './modules/assets/batch-routes.js';
// 在现有 assetRoutes 注册后:
await app.register(assetBatchRoutes, { prefix: '/api/assets' });
```

**提交**: `feat(api): batch assign, batch status, and CSV import endpoints`

---

### Task 4.2 — 批量操作 (前端)

**文件**: `frontend/src/app/(dashboard)/assets/page.tsx` (99 行)

大幅修改:
1. 添加 `selectedIds: Set<string>` state
2. 表格左侧添加 checkbox 列
3. 表格上方添加批量操作工具栏:
   - 选中数量显示
   - "批量分配" 按钮 → 打开 Dialog (选择部门+人员)
   - "批量状态" 按钮 → 打开 Dialog (选择目标状态)
   - "CSV 导入" 按钮 → 打开 Dialog (上传文件+预览+确认)
4. 全选 checkbox 在表头

**提交**: `feat(ui): asset batch operations UI with select, assign, status, import`

---

### Task 4.3 — 资产生命周期管理 (后端)

**新建文件**: `backend/src/modules/assets/history-service.ts`

```typescript
import { PrismaClient } from '@prisma/client';

export class AssetHistoryService {
  constructor(private prisma: PrismaClient) {}

  async record(assetId: string, action: string, data: {
    fromUserId?: string; toUserId?: string;
    fromStatus?: string; toStatus?: string;
    details?: any;
  }) {
    return this.prisma.assetHistory.create({
      data: { assetId, action, ...data },
    });
  }

  async list(assetId: string, page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.assetHistory.findMany({
        where: { assetId }, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.assetHistory.count({ where: { assetId } }),
    ]);
    return { items, total, page, limit };
  }
}
```

**新建文件**: `backend/src/modules/assets/maintenance-service.ts`

```typescript
import { PrismaClient } from '@prisma/client';

export class MaintenanceService {
  constructor(private prisma: PrismaClient) {}

  async create(assetId: string, data: {
    reason: string; vendor?: string; cost?: number;
    startDate: string; endDate?: string; notes?: string;
  }) {
    return this.prisma.maintenanceRecord.create({
      data: {
        assetId, reason: data.reason, vendor: data.vendor,
        cost: data.cost, startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        notes: data.notes,
      },
    });
  }

  async list(assetId: string) {
    return this.prisma.maintenanceRecord.findMany({
      where: { assetId }, orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    return this.prisma.maintenanceRecord.delete({ where: { id } });
  }
}
```

**文件**: `backend/src/modules/assets/routes.ts` 追加路由:

```typescript
// GET /:id/history
fastify.get('/:id/history', { preHandler: [requirePermission('asset:read')] }, ...);

// GET /:id/maintenance
fastify.get('/:id/maintenance', { preHandler: [requirePermission('asset:read')] }, ...);

// POST /:id/maintenance
fastify.post('/:id/maintenance', { preHandler: [requirePermission('asset:write')] }, ...);

// DELETE /:id/maintenance/:mid
fastify.delete('/:id/maintenance/:mid', { preHandler: [requirePermission('asset:write')] }, ...);
```

**修改**: `AssetService.create/update` 中状态/分配变更时自动调用 `AssetHistoryService.record()`

**提交**: `feat: asset lifecycle with history and maintenance records`

---

### Task 4.4 — 资产生命周期管理 (前端)

**文件**: `frontend/src/app/(dashboard)/assets/[id]/page.tsx` (216 行)

添加 Tabs 组件切换:
- **基本信息** Tab: 现有编辑表单
- **历史记录** Tab: 时间线视图 (`GET /api/assets/:id/history`)
- **维修记录** Tab: 表格 + "添加记录"按钮 + Dialog

**提交**: `feat(ui): asset detail page with history timeline and maintenance tabs`

---

### Task 4.5 — 仪表盘可视化增强

**步骤 1**: 安装 recharts
```bash
cd frontend && npm install recharts
```

**文件**: `frontend/src/app/(dashboard)/dashboard/page.tsx` (132 行)

重写为增强版:
- 4 个统计卡片: 设备总数 / 已注册 / 资产总数 / 待处理
- 资产状态分布饼图 (PieChart)
- 设备类型分布柱状图 (BarChart)
- 部门资产占比图 (横向 BarChart)
- 近 30 天趋势折线图 (LineChart)

**文件**: `backend/src/modules/reports/routes.ts` (或 service)

添加聚合接口 `GET /api/reports/dashboard-stats`:
```typescript
{
  deviceStats: { total, enrolled, pending, unenrolled, byType: [...] },
  assetStats: { total, byStatus: [...], byDepartment: [...] },
  recentChanges: [...], // 近30天每日变动数
}
```

**提交**: `feat: enhanced dashboard with recharts visualizations`

---

### Task 4.6 — 审计日志增强

**文件**: `backend/src/modules/audit/routes.ts` (17 行)

添加 CSV 导出端点:
```typescript
fastify.get('/export', { preHandler: [requirePermission('audit:read')] }, async (request, reply) => {
  const { userId, action, targetType, startDate, endDate } = request.query as any;
  const logs = await auditService.listAll({ userId, action, targetType, startDate, endDate });
  const csv = generateCsv(logs);
  reply.header('Content-Type', 'text/csv');
  reply.header('Content-Disposition', 'attachment; filename=audit-logs.csv');
  return csv;
});
```

**文件**: `frontend/src/app/(dashboard)/audit-logs/page.tsx`

增强:
- 筛选器栏: 操作类型、目标类型、日期范围
- 导出 CSV 按钮
- 点击行展开详情 (变更前后对比 JSON diff)

**提交**: `feat: audit log filters, CSV export, and detail comparison`


---

## Phase 5: MDM 标准功能

### Task 5.1 — 应用管理 (后端)

**新建文件**: `backend/src/modules/apps/service.ts`

```typescript
import { PrismaClient } from '@prisma/client';

export class AppService {
  constructor(private prisma: PrismaClient) {}

  async list(page = 1, limit = 20, filters?: { search?: string; category?: string }) {
    const where: any = {};
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { bundleId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.category) where.category = filters.category;
    const [apps, total] = await Promise.all([
      this.prisma.app.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
        include: { _count: { select: { assignments: true } } },
      }),
      this.prisma.app.count({ where }),
    ]);
    return { apps, total, page, limit };
  }

  async getById(id: string) {
    return this.prisma.app.findUniqueOrThrow({
      where: { id },
      include: {
        assignments: {
          include: {
            device: { select: { id: true, deviceName: true, serialNumber: true } },
            department: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async create(data: { bundleId: string; name: string; version?: string; category?: string; managedApp?: boolean; source?: string }) {
    return this.prisma.app.create({ data });
  }

  async update(id: string, data: Partial<{ name: string; version: string; category: string }>) {
    return this.prisma.app.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.app.delete({ where: { id } });
  }

  async install(appId: string, targets: { deviceIds?: string[]; departmentId?: string }) {
    const assignments = [];
    if (targets.deviceIds) {
      for (const deviceId of targets.deviceIds) {
        assignments.push(
          this.prisma.appAssignment.create({
            data: { appId, deviceId, status: 'pending' },
          })
        );
      }
    }
    if (targets.departmentId) {
      assignments.push(
        this.prisma.appAssignment.create({
          data: { appId, departmentId: targets.departmentId, status: 'pending' },
        })
      );
    }
    return Promise.all(assignments);
  }

  async uninstall(appId: string, deviceIds: string[]) {
    return this.prisma.appAssignment.updateMany({
      where: { appId, deviceId: { in: deviceIds } },
      data: { status: 'removed' },
    });
  }
}
```

**新建文件**: `backend/src/modules/apps/routes.ts`

```typescript
import { FastifyPluginAsync } from 'fastify';
import { AppService } from './service.js';
import { requirePermission } from '../../middleware/authenticate.js';
import { AuditService } from '../audit/service.js';

const appRoutes: FastifyPluginAsync = async (fastify) => {
  const appService = new AppService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  fastify.get('/', { preHandler: [requirePermission('app:read')] }, async (request) => {
    const { page, limit, search, category } = request.query as any;
    return appService.list(parseInt(page) || 1, parseInt(limit) || 20, { search, category });
  });

  fastify.get('/:id', { preHandler: [requirePermission('app:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try { return await appService.getById(id); }
    catch { return reply.status(404).send({ error: 'App not found', code: 404 }); }
  });

  fastify.post('/', { preHandler: [requirePermission('app:write')] }, async (request) => {
    const data = request.body as any;
    const app = await appService.create(data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'app.create', 'app', app.id, data, request.ip);
    return app;
  });

  fastify.put('/:id', { preHandler: [requirePermission('app:write')] }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const app = await appService.update(id, data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'app.update', 'app', id, data, request.ip);
    return app;
  });

  fastify.delete('/:id', { preHandler: [requirePermission('app:write')] }, async (request) => {
    const { id } = request.params as { id: string };
    await appService.remove(id);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'app.delete', 'app', id, {}, request.ip);
    return { message: 'App removed' };
  });

  fastify.post('/:id/install', { preHandler: [requirePermission('app:deploy')] }, async (request) => {
    const { id } = request.params as { id: string };
    const { deviceIds, departmentId } = request.body as { deviceIds?: string[]; departmentId?: string };
    const results = await appService.install(id, { deviceIds, departmentId });
    const user = request.user as { id: string };
    await auditService.log(user.id, 'app.install', 'app', id, { deviceIds, departmentId }, request.ip);
    return { installed: results.length };
  });

  fastify.post('/:id/uninstall', { preHandler: [requirePermission('app:deploy')] }, async (request) => {
    const { id } = request.params as { id: string };
    const { deviceIds } = request.body as { deviceIds: string[] };
    await appService.uninstall(id, deviceIds);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'app.uninstall', 'app', id, { deviceIds }, request.ip);
    return { message: 'Uninstall initiated' };
  });
};

export default appRoutes;
```

**文件**: `backend/src/app.ts` 注册:
```typescript
import appRoutes from './modules/apps/routes.js';
await app.register(appRoutes, { prefix: '/api/apps' });
```

**提交**: `feat: app management backend with CRUD and install/uninstall`

---

### Task 5.2 — 应用管理 (前端)

**新建文件**: `frontend/src/app/(dashboard)/apps/page.tsx`

应用列表页:
- 搜索栏 + 分类筛选
- 表格: 名称, Bundle ID, 版本, 分类, 安装数, 操作
- "新建应用" 按钮

**新建文件**: `frontend/src/app/(dashboard)/apps/new/page.tsx`

创建应用表单:
- Bundle ID, 名称, 版本, 分类, 来源

**新建文件**: `frontend/src/app/(dashboard)/apps/[id]/page.tsx`

应用详情页:
- 应用信息卡片
- 已安装设备列表
- "安装到设备" 按钮 → Dialog (设备选择器)
- "安装到部门" 按钮 → Dialog (部门选择器)

**提交**: `feat: app management frontend pages`

---

### Task 5.3 — 内容管理 (后端)

**新建文件**: `backend/src/modules/contents/service.ts`

与 AppService 结构类似，增加文件上传处理:
- `create()` 处理 multipart 文件上传
- 文件存储到 `./uploads/contents/` 目录

**新建文件**: `backend/src/modules/contents/routes.ts`

```typescript
// GET /api/contents — 列表
// GET /api/contents/:id — 详情
// POST /api/contents — 创建 (multipart)
// PUT /api/contents/:id — 更新
// DELETE /api/contents/:id — 删除
// POST /api/contents/:id/distribute — 分发
// POST /api/contents/:id/remove — 移除
```

**文件**: `backend/src/app.ts`
- 注册 `@fastify/multipart` 插件
- 注册 `@fastify/static` 服务 `/uploads`
- 注册内容路由

**安装依赖**:
```bash
cd backend && npm install @fastify/multipart @fastify/static
```

**提交**: `feat: content management backend with file upload`

---

### Task 5.4 — 内容管理 (前端)

**新建文件**: `frontend/src/app/(dashboard)/contents/page.tsx`

内容库列表页:
- 搜索 + 类型筛选 (document/book/media)
- 表格: 名称, 类型, 大小, 版本, 分发数, 操作
- "新建内容" 按钮
- 文件上传支持

**新建文件**: `frontend/src/app/(dashboard)/contents/new/page.tsx`

上传表单: 名称, 类型选择, 文件拖拽/选择, 描述

**新建文件**: `frontend/src/app/(dashboard)/contents/[id]/page.tsx`

内容详情: 信息 + 已分发设备列表 + 分发操作

**提交**: `feat: content management frontend pages`

---

### Task 5.5 — 侧边栏 & 路由更新

**文件**: `frontend/src/components/layout/sidebar.tsx` L24-L55

**步骤 A** — 添加 import:
```typescript
import { AppWindow, FileText } from 'lucide-react';
```

**步骤 B** — 在 `sidebar.deviceAssets` group (L31-L38) 的 profiles 之后添加:
```typescript
{ href: '/apps', labelKey: 'sidebar.apps', icon: AppWindow, permission: 'app:read' },
{ href: '/contents', labelKey: 'sidebar.contents', icon: FileText, permission: 'content:read' },
```

**提交**: `feat: add Apps and Contents to sidebar navigation`


---

## Phase 6: i18n 补全 & 部署

### Task 6.1 — i18n 新增键值对

**文件**: `frontend/src/i18n/zh.json` 和 `frontend/src/i18n/en.json`

追加以下键值对 (两个文件同步):

**zh.json 新增:**
```json
"common.select": "选择",
"common.testEmail": "发送测试邮件",
"common.testEmailSuccess": "测试邮件已发送",
"common.testEmailFailed": "测试邮件发送失败",
"common.selectAll": "全选",
"common.batchAssign": "批量分配",
"common.batchStatus": "批量状态变更",
"common.csvImport": "CSV 导入",
"common.csvExport": "CSV 导出",
"common.selected": "已选 {{count}} 项",
"common.upload": "上传",
"common.download": "下载",
"common.preview": "预览",
"common.close": "关闭",
"common.success": "操作成功",
"common.failed": "操作失败",
"sidebar.apps": "应用管理",
"sidebar.contents": "内容管理",
"apps.title": "应用管理",
"apps.new": "新建应用",
"apps.searchPlaceholder": "搜索应用名称、Bundle ID...",
"apps.name": "应用名称",
"apps.bundleId": "Bundle ID",
"apps.version": "版本",
"apps.category": "分类",
"apps.source": "来源",
"apps.managedApp": "受管应用",
"apps.installCount": "安装数",
"apps.noApps": "暂无应用",
"apps.install": "安装",
"apps.uninstall": "卸载",
"apps.installToDevices": "安装到设备",
"apps.installToDepartment": "安装到部门",
"apps.selectDevices": "选择设备",
"apps.selectDepartment": "选择部门",
"apps.detail": "应用详情",
"apps.installedDevices": "已安装设备",
"apps.deleteConfirm": "确定要删除应用 \"{{name}}\" 吗？",
"contents.title": "内容管理",
"contents.new": "新建内容",
"contents.searchPlaceholder": "搜索内容名称...",
"contents.name": "内容名称",
"contents.type": "类型",
"contents.fileSize": "文件大小",
"contents.version": "版本",
"contents.distributeCount": "分发数",
"contents.noContents": "暂无内容",
"contents.distribute": "分发",
"contents.remove": "移除",
"contents.detail": "内容详情",
"contents.uploadFile": "上传文件",
"contents.description": "描述",
"contents.deleteConfirm": "确定要删除内容 \"{{name}}\" 吗？",
"contents.types.document": "文档",
"contents.types.book": "书籍",
"contents.types.media": "媒体",
"assets.history": "历史记录",
"assets.maintenance": "维修记录",
"assets.addMaintenance": "添加维修记录",
"assets.maintenance.reason": "维修原因",
"assets.maintenance.vendor": "维修商",
"assets.maintenance.cost": "维修费用",
"assets.maintenance.startDate": "开始日期",
"assets.maintenance.endDate": "结束日期",
"assets.history.assign": "分配变更",
"assets.history.statusChange": "状态变更",
"assets.history.create": "创建",
"batch.assignTitle": "批量分配",
"batch.statusTitle": "批量状态变更",
"batch.importTitle": "CSV 导入",
"batch.importHint": "上传 CSV 文件，支持字段: deviceId, purchaseDate, purchasePrice, warrantyEnd, assignedToId, departmentId, location, status, notes",
"batch.parseSuccess": "解析成功，共 {{count}} 条记录",
"batch.parseFailed": "CSV 解析失败",
"batch.importing": "导入中...",
"batch.importSuccess": "导入成功 {{count}} 条",
"dashboard.assetTotal": "资产总数",
"dashboard.pendingTasks": "待处理",
"dashboard.assetStatusDistribution": "资产状态分布",
"dashboard.departmentAssetDistribution": "部门资产占比",
"dashboard.trendChart": "近 30 天趋势",
"audit.export": "导出",
"audit.detail": "审计详情",
"audit.changes": "变更内容",
"audit.dateRange": "日期范围",
"audit.startDate": "开始日期",
"audit.endDate": "结束日期"
```

**en.json 新增 (对照):**
```json
"common.select": "Select",
"common.testEmail": "Send Test Email",
"common.testEmailSuccess": "Test email sent",
"common.testEmailFailed": "Failed to send test email",
"common.selectAll": "Select All",
"common.batchAssign": "Batch Assign",
"common.batchStatus": "Batch Status",
"common.csvImport": "CSV Import",
"common.csvExport": "CSV Export",
"common.selected": "{{count}} selected",
"common.upload": "Upload",
"common.download": "Download",
"common.preview": "Preview",
"common.close": "Close",
"common.success": "Success",
"common.failed": "Failed",
"sidebar.apps": "App Management",
"sidebar.contents": "Content Management",
"apps.title": "App Management",
"apps.new": "New App",
"apps.searchPlaceholder": "Search app name, Bundle ID...",
"apps.name": "App Name",
"apps.bundleId": "Bundle ID",
"apps.version": "Version",
"apps.category": "Category",
"apps.source": "Source",
"apps.managedApp": "Managed App",
"apps.installCount": "Installs",
"apps.noApps": "No apps found",
"apps.install": "Install",
"apps.uninstall": "Uninstall",
"apps.installToDevices": "Install to Devices",
"apps.installToDepartment": "Install to Department",
"apps.selectDevices": "Select Devices",
"apps.selectDepartment": "Select Department",
"apps.detail": "App Details",
"apps.installedDevices": "Installed Devices",
"apps.deleteConfirm": "Are you sure you want to delete app \"{{name}}\"?",
"contents.title": "Content Management",
"contents.new": "New Content",
"contents.searchPlaceholder": "Search content name...",
"contents.name": "Content Name",
"contents.type": "Type",
"contents.fileSize": "File Size",
"contents.version": "Version",
"contents.distributeCount": "Distributions",
"contents.noContents": "No content found",
"contents.distribute": "Distribute",
"contents.remove": "Remove",
"contents.detail": "Content Details",
"contents.uploadFile": "Upload File",
"contents.description": "Description",
"contents.deleteConfirm": "Are you sure you want to delete content \"{{name}}\"?",
"contents.types.document": "Document",
"contents.types.book": "Book",
"contents.types.media": "Media",
"assets.history": "History",
"assets.maintenance": "Maintenance",
"assets.addMaintenance": "Add Maintenance Record",
"assets.maintenance.reason": "Reason",
"assets.maintenance.vendor": "Vendor",
"assets.maintenance.cost": "Cost",
"assets.maintenance.startDate": "Start Date",
"assets.maintenance.endDate": "End Date",
"assets.history.assign": "Assignment Change",
"assets.history.statusChange": "Status Change",
"assets.history.create": "Created",
"batch.assignTitle": "Batch Assign",
"batch.statusTitle": "Batch Status Change",
"batch.importTitle": "CSV Import",
"batch.importHint": "Upload CSV file. Supported fields: deviceId, purchaseDate, purchasePrice, warrantyEnd, assignedToId, departmentId, location, status, notes",
"batch.parseSuccess": "Parsed {{count}} records",
"batch.parseFailed": "CSV parse failed",
"batch.importing": "Importing...",
"batch.importSuccess": "Imported {{count}} records",
"dashboard.assetTotal": "Total Assets",
"dashboard.pendingTasks": "Pending Tasks",
"dashboard.assetStatusDistribution": "Asset Status Distribution",
"dashboard.departmentAssetDistribution": "Department Asset Distribution",
"dashboard.trendChart": "30-Day Trend",
"audit.export": "Export",
"audit.detail": "Audit Detail",
"audit.changes": "Changes",
"audit.dateRange": "Date Range",
"audit.startDate": "Start Date",
"audit.endDate": "End Date"
```

**提交**: `feat(i18n): add all new translation keys for apps, contents, batch, dashboard, audit`

---

### Task 6.2 — Docker 修复

**文件**: `docker-compose.yml`

确保 uploads 卷挂载:
```yaml
services:
  backend:
    volumes:
      - uploads:/app/uploads
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  uploads:
  pgdata:
  redis-data:
```

**文件**: `backend/Dockerfile`

确保 uploads 目录在构建时创建:
```dockerfile
# 在 COPY . . 之后添加:
RUN mkdir -p /app/uploads/contents
```

**文件**: `frontend/Dockerfile`

确保 Next.js standalone 输出 + 静态文件:
```dockerfile
# 确保 output: 'standalone' 在 next.config.ts
# COPY --from=builder /app/.next/standalone ./
# COPY --from=builder /app/.next/static ./.next/static
# COPY --from=builder /app/public ./public
```

**提交**: `fix(docker): uploads volume, healthcheck, build fixes`

---

### Task 6.3 — 构建验证 & 冒烟测试

**构建验证脚本** (不创建文件，直接执行):

```bash
# 1. 后端编译
cd backend && npx tsc --noEmit && echo "✓ Backend TypeScript OK"

# 2. Prisma generate
npx prisma generate && echo "✓ Prisma generate OK"

# 3. 前端构建
cd ../frontend && npm run build && echo "✓ Frontend build OK"

# 4. Docker compose 构建
cd .. && docker compose build && echo "✓ Docker build OK"
```

**冒烟测试清单** (手动):
- [ ] `POST /api/auth/login` — 登录获取 token
- [ ] `GET /api/devices` — 设备列表 (带分页)
- [ ] `GET /api/assets` — 资产列表
- [ ] `POST /api/assets` — 创建资产 (DevicePicker 选设备)
- [ ] `GET /api/apps` — 应用列表
- [ ] `GET /api/contents` — 内容列表
- [ ] `PUT /api/settings/smtp` — 保存 SMTP 配置
- [ ] `POST /api/settings/smtp/test` — 测试邮件
- [ ] `GET /api/audit-logs` — 审计日志 (含权限检查)
- [ ] `GET /api/reports/dashboard-stats` — 仪表盘数据
- [ ] 切换中英文 — 所有页面无硬编码中文
- [ ] 暗色模式 — 所有 select 和表单正确显示

**提交**: `chore: build verification and smoke test checklist`

---

## 执行总结

| Phase | Task | 说明 | 涉及文件数 |
|-------|------|------|-----------|
| 1 | 1.1 | Schema 新增 7 模型 | 1 |
| 1 | 1.2 | Seed 补全权限 | 1 |
| 1 | 1.3 | Migration + generate | 0 (命令) |
| 2 | 2.1 | 审计路由权限 | 1 |
| 2 | 2.2 | MDM 命令枚举校验 | 1 |
| 2 | 2.3 | 资产表单补状态 + textarea | 1 |
| 2 | 2.4 | 货币格式化 | 1 |
| 2 | 2.5 | label htmlFor | 1 |
| 2 | 2.6 | Settings SMTP i18n | 1 |
| 2 | 2.7 | Settings 其余 i18n | 1 |
| 2 | 2.8 | 错误处理统一 | 4 |
| 2 | 2.9 | 消除 as any | 3 |
| 2 | 2.10 | select 暗色模式 | 5+ |
| 3 | 3.1 | SystemSetting + SMTP DB | 3 (1 新 + 2 改) |
| 3 | 3.2 | DevicePicker | 3 (1 新 + 2 改) |
| 3 | 3.3 | 邮件模板 | 1 (新) |
| 3 | 3.4 | 通知触发接线 | 3 |
| 3 | 3.5 | 测试邮件按钮 | 1 |
| 4 | 4.1 | 批量操作后端 | 2 (1 新 + 1 改) |
| 4 | 4.2 | 批量操作前端 | 1 |
| 4 | 4.3 | 资产生命周期后端 | 3 (2 新 + 1 改) |
| 4 | 4.4 | 资产生命周期前端 | 1 |
| 4 | 4.5 | 仪表盘可视化 | 2 |
| 4 | 4.6 | 审计日志增强 | 2 |
| 5 | 5.1 | 应用管理后端 | 3 (2 新 + 1 改) |
| 5 | 5.2 | 应用管理前端 | 3 (新) |
| 5 | 5.3 | 内容管理后端 | 3 (2 新 + 1 改) |
| 5 | 5.4 | 内容管理前端 | 3 (新) |
| 5 | 5.5 | 侧边栏路由更新 | 1 |
| 6 | 6.1 | i18n 新增键 | 2 |
| 6 | 6.2 | Docker 修复 | 3 |
| 6 | 6.3 | 构建验证 | 0 (命令) |

**总计**: 27 个任务，约 52 个文件 (含新建 ~15 个)

**预计提交**: 27 个原子提交，可选 squash 为 6 个 phase 级提交

---

> 本文档按依赖顺序编写，Phase 1→2→3→4→5→6 严格按序执行。
> 同一 Phase 内的 Task 可根据无依赖关系并行处理。
