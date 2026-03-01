# 组织架构 + RBAC 权限系统 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 myDevices 增加树形部门管理、人员管理、动态角色权限管理，实现部门级数据隔离和配置文件下发类型控制。

**Architecture:** 经典 RBAC 模型。新增 Department/Role/Permission/RolePermission 四张表，改造 User 表关联 Role 和 Department。后端 Fastify 中间件从 requireRole 改为 requirePermission，service 层增加 dataScope 过滤。前端 useAuth 扩展权限列表，侧边栏动态渲染。

**Tech Stack:** Prisma 7 + PostgreSQL, Fastify + JWT, Next.js 14 + shadcn/ui, TypeScript

---

## Task 1: Prisma Schema 改造

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: 添加新枚举和新表，改造 User 表**

在 schema.prisma 中：

1. 新增 `DataScope` 枚举（放在 `CommandStatus` 枚举后面）：

```prisma
enum DataScope {
  all
  department_and_children
  department
  self
}
```

2. 新增 `Department` model：

```prisma
model Department {
  id        String       @id @default(uuid())
  name      String
  code      String       @unique
  parentId  String?      @map("parent_id")
  sortOrder Int          @default(0) @map("sort_order")
  createdAt DateTime     @default(now()) @map("created_at")
  updatedAt DateTime     @updatedAt @map("updated_at")
  parent    Department?  @relation("DeptTree", fields: [parentId], references: [id])
  children  Department[] @relation("DeptTree")
  users     User[]
  @@map("departments")
}
```

3. 新增 `Role` model：

```prisma
model Role {
  id                  String           @id @default(uuid())
  name                String
  code                String           @unique
  description         String?
  dataScope           DataScope        @default(department) @map("data_scope")
  allowedProfileTypes String[]         @default([]) @map("allowed_profile_types")
  isSystem            Boolean          @default(false) @map("is_system")
  createdAt           DateTime         @default(now()) @map("created_at")
  updatedAt           DateTime         @updatedAt @map("updated_at")
  permissions         RolePermission[]
  users               User[]
  @@map("roles")
}
```

4. 新增 `Permission` model：

```prisma
model Permission {
  id        String           @id @default(uuid())
  code      String           @unique
  name      String
  module    String
  sortOrder Int              @default(0) @map("sort_order")
  roles     RolePermission[]
  @@map("permissions")
}
```

5. 新增 `RolePermission` model：

```prisma
model RolePermission {
  roleId       String     @map("role_id")
  permissionId String     @map("permission_id")
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleId, permissionId])
  @@map("role_permissions")
}
```

6. 改造 `User` model — 移除 `role UserRole` 字段，新增 `roleId` 和 `departmentId`：

```prisma
model User {
  id           String      @id @default(uuid())
  email        String      @unique
  name         String
  roleId       String      @map("role_id")
  departmentId String?     @map("department_id")
  passwordHash String      @map("password_hash")
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
  role         Role        @relation(fields: [roleId], references: [id])
  department   Department? @relation(fields: [departmentId], references: [id])
  auditLogs    AuditLog[]
  @@map("users")
}
```

7. 删除 `UserRole` 枚举。

**Step 2: 生成并应用迁移**

```bash
cd backend && npx prisma migrate dev --name add-rbac-org-tables
```

注意：因为移除了 User.role 字段并新增了必填的 roleId，需要先在迁移 SQL 中手动处理数据迁移（见 Task 2）。

**Step 3: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add RBAC schema - Department, Role, Permission tables, refactor User"
```


---

## Task 2: Seed 脚本改造

**Files:**
- Modify: `backend/prisma/seed.ts`

**Step 1: 重写 seed 脚本**

seed 脚本需要：
1. 先创建所有 Permission 权限点
2. 创建 3 个系统预置 Role，并关联对应权限
3. 创建部门树（示例数据）
4. 创建用户时使用 roleId 和 departmentId 替代旧的 role 枚举
5. 其余设备/资产/审计数据保持不变

权限点数据（25 个）：

```typescript
const PERMISSIONS = [
  { code: 'dashboard:view', name: '查看仪表盘', module: 'dashboard', sortOrder: 1 },
  { code: 'device:read', name: '查看设备', module: 'device', sortOrder: 2 },
  { code: 'device:write', name: '编辑设备', module: 'device', sortOrder: 3 },
  { code: 'device:delete', name: '删除设备', module: 'device', sortOrder: 4 },
  { code: 'asset:read', name: '查看资产', module: 'asset', sortOrder: 5 },
  { code: 'asset:write', name: '编辑资产', module: 'asset', sortOrder: 6 },
  { code: 'asset:delete', name: '删除资产', module: 'asset', sortOrder: 7 },
  { code: 'profile:read', name: '查看配置文件', module: 'profile', sortOrder: 8 },
  { code: 'profile:write', name: '编辑配置文件', module: 'profile', sortOrder: 9 },
  { code: 'profile:deploy', name: '下发配置文件', module: 'profile', sortOrder: 10 },
  { code: 'mdm:command', name: '下发MDM命令', module: 'mdm', sortOrder: 11 },
  { code: 'audit:read', name: '查看审计日志', module: 'audit', sortOrder: 12 },
  { code: 'report:read', name: '查看报表', module: 'report', sortOrder: 13 },
  { code: 'user:read', name: '查看人员', module: 'user', sortOrder: 14 },
  { code: 'user:write', name: '编辑人员', module: 'user', sortOrder: 15 },
  { code: 'user:delete', name: '删除人员', module: 'user', sortOrder: 16 },
  { code: 'dept:read', name: '查看部门', module: 'department', sortOrder: 17 },
  { code: 'dept:write', name: '编辑部门', module: 'department', sortOrder: 18 },
  { code: 'dept:delete', name: '删除部门', module: 'department', sortOrder: 19 },
  { code: 'role:read', name: '查看角色', module: 'role', sortOrder: 20 },
  { code: 'role:write', name: '编辑角色', module: 'role', sortOrder: 21 },
  { code: 'role:delete', name: '删除角色', module: 'role', sortOrder: 22 },
  { code: 'settings:read', name: '查看设置', module: 'settings', sortOrder: 23 },
  { code: 'settings:write', name: '编辑设置', module: 'settings', sortOrder: 24 },
];
```

角色定义：

```typescript
const ROLES = [
  {
    code: 'super_admin', name: '超级管理员', description: '系统最高权限',
    dataScope: 'all', isSystem: true, allowedProfileTypes: [],
    permissionCodes: PERMISSIONS.map(p => p.code), // 全部权限
  },
  {
    code: 'device_admin', name: '设备管理员', description: '管理设备和资产',
    dataScope: 'department_and_children', isSystem: true, allowedProfileTypes: [],
    permissionCodes: [
      'dashboard:view', 'device:read', 'device:write', 'device:delete',
      'asset:read', 'asset:write', 'asset:delete',
      'profile:read', 'profile:write', 'profile:deploy',
      'mdm:command', 'audit:read', 'report:read',
    ],
  },
  {
    code: 'readonly', name: '只读用户', description: '只能查看数据',
    dataScope: 'department', isSystem: true, allowedProfileTypes: [],
    permissionCodes: [
      'dashboard:view', 'device:read', 'asset:read', 'profile:read',
      'audit:read', 'report:read',
    ],
  },
];
```

部门示例数据：

```typescript
const DEPARTMENTS = [
  { code: 'hq', name: '总公司', parentCode: null, sortOrder: 1 },
  { code: 'tech', name: '技术中心', parentCode: 'hq', sortOrder: 1 },
  { code: 'market', name: '市场部', parentCode: 'hq', sortOrder: 2 },
  { code: 'finance', name: '财务部', parentCode: 'hq', sortOrder: 3 },
  { code: 'hr', name: '人事部', parentCode: 'hq', sortOrder: 4 },
  { code: 'frontend', name: '前端组', parentCode: 'tech', sortOrder: 1 },
  { code: 'backend', name: '后端组', parentCode: 'tech', sortOrder: 2 },
  { code: 'ops', name: '运维组', parentCode: 'tech', sortOrder: 3 },
];
```

用户创建改为：
- admin → roleId = super_admin 角色的 id, departmentId = 总公司
- deviceadmin → roleId = device_admin 角色的 id, departmentId = 技术中心
- viewer → roleId = readonly 角色的 id, departmentId = 前端组

资产数据中的 department 字段改为从部门表中随机选取部门名称。

**Step 2: 运行 seed 验证**

```bash
cd backend && npx prisma db seed
```

**Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: update seed with RBAC data - permissions, roles, departments"
```


---

## Task 3: 后端中间件改造

**Files:**
- Modify: `backend/src/middleware/authenticate.ts`

**Step 1: 新增 requirePermission 中间件，改造 authenticate**

`authenticate` 保持不变（JWT 验证 + 黑名单检查）。

新增 `requirePermission(...codes: string[])` 中间件：
1. 先调用 authenticate 逻辑
2. 从 JWT payload 中取 userId
3. 查询用户的 Role → RolePermission → Permission，获取权限 code 列表
4. 检查用户是否拥有所需权限中的任意一个
5. 无权限返回 403

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
    const { id } = request.user as { id: string };
    const user = await request.server.prisma.user.findUnique({
      where: { id },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user) return reply.status(401).send({ error: 'User not found' });
    const userPermissions = user.role.permissions.map(rp => rp.permission.code);
    if (!codes.some(code => userPermissions.includes(code))) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    // 将权限列表和角色信息挂到 request 上供后续使用
    (request as any).userPermissions = userPermissions;
    (request as any).userRole = user.role;
    (request as any).userDepartmentId = user.departmentId;
  };
}
```

保留 `requireRole` 兼容旧代码（内部改为查 Role.code）：

```typescript
export function requireRole(...roleCodes: string[]) {
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
    const { id } = request.user as { id: string };
    const user = await request.server.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user || !roleCodes.includes(user.role.code)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  };
}
```

**Step 2: 新增 dataScope 过滤工具函数**

在同一文件或新建 `backend/src/middleware/data-scope.ts`：

```typescript
import { PrismaClient, DataScope } from '@prisma/client';

// 获取部门及所有子部门 ID（递归）
export async function getDepartmentAndChildrenIds(prisma: PrismaClient, departmentId: string): Promise<string[]> {
  const result: string[] = [departmentId];
  const children = await prisma.department.findMany({ where: { parentId: departmentId }, select: { id: true } });
  for (const child of children) {
    const childIds = await getDepartmentAndChildrenIds(prisma, child.id);
    result.push(...childIds);
  }
  return result;
}

// 根据 dataScope 构建 where 条件（用于设备/资产查询）
export async function buildDataScopeFilter(
  prisma: PrismaClient,
  dataScope: DataScope,
  userId: string,
  departmentId: string | null,
): Promise<any> {
  switch (dataScope) {
    case 'all':
      return {};
    case 'department_and_children': {
      if (!departmentId) return { id: '__none__' }; // 无部门则无数据
      const deptIds = await getDepartmentAndChildrenIds(prisma, departmentId);
      return { asset: { department: { in: deptIds } } }; // 需要根据实际模型调整
    }
    case 'department': {
      if (!departmentId) return { id: '__none__' };
      return { asset: { department: departmentId } };
    }
    case 'self':
      return { asset: { assignedTo: userId } };
    default:
      return {};
  }
}
```

**Step 3: Commit**

```bash
git add backend/src/middleware/
git commit -m "feat: add requirePermission middleware and dataScope filter"
```


---

## Task 4: 部门管理后端

**Files:**
- Create: `backend/src/modules/departments/service.ts`
- Create: `backend/src/modules/departments/routes.ts`
- Modify: `backend/src/app.ts` — 注册路由

**Step 1: 创建 DepartmentService**

`backend/src/modules/departments/service.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

export class DepartmentService {
  constructor(private prisma: PrismaClient) {}

  // 获取完整部门树
  async getTree() {
    const departments = await this.prisma.department.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
    return this.buildTree(departments, null);
  }

  private buildTree(departments: any[], parentId: string | null): any[] {
    return departments
      .filter(d => d.parentId === parentId)
      .map(d => ({
        ...d,
        children: this.buildTree(departments, d.id),
      }));
  }

  // 扁平列表（用于下拉选择）
  async list() {
    return this.prisma.department.findMany({
      orderBy: [{ sortOrder: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
  }

  async getById(id: string) {
    return this.prisma.department.findUniqueOrThrow({
      where: { id },
      include: { parent: true, children: true, _count: { select: { users: true } } },
    });
  }

  async create(data: { name: string; code: string; parentId?: string; sortOrder?: number }) {
    return this.prisma.department.create({ data });
  }

  async update(id: string, data: { name?: string; code?: string; parentId?: string; sortOrder?: number }) {
    return this.prisma.department.update({ where: { id }, data });
  }

  async remove(id: string) {
    // 检查是否有子部门
    const children = await this.prisma.department.count({ where: { parentId: id } });
    if (children > 0) throw new Error('该部门下有子部门，无法删除');
    // 检查是否有人员
    const users = await this.prisma.user.count({ where: { departmentId: id } });
    if (users > 0) throw new Error('该部门下有人员，无法删除');
    return this.prisma.department.delete({ where: { id } });
  }
}
```

**Step 2: 创建部门路由**

`backend/src/modules/departments/routes.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { DepartmentService } from './service.js';
import { AuditService } from '../audit/service.js';
import { requirePermission } from '../../middleware/authenticate.js';

const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  const deptService = new DepartmentService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  // 获取部门树
  fastify.get('/tree', { preHandler: [requirePermission('dept:read')] }, async () => {
    return deptService.getTree();
  });

  // 扁平列表（下拉用）
  fastify.get('/', { preHandler: [requirePermission('dept:read')] }, async () => {
    return deptService.list();
  });

  // 获取单个部门
  fastify.get('/:id', { preHandler: [requirePermission('dept:read')] }, async (request) => {
    const { id } = request.params as { id: string };
    return deptService.getById(id);
  });

  // 创建部门
  fastify.post('/', {
    preHandler: [requirePermission('dept:write')],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          code: { type: 'string', minLength: 1, maxLength: 50 },
          parentId: { type: 'string', format: 'uuid' },
          sortOrder: { type: 'integer' },
        },
      },
    },
  }, async (request) => {
    const data = request.body as { name: string; code: string; parentId?: string; sortOrder?: number };
    const dept = await deptService.create(data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'dept.create', 'department', dept.id, data, request.ip);
    return dept;
  });

  // 更新部门
  fastify.put('/:id', { preHandler: [requirePermission('dept:write')] }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const dept = await deptService.update(id, data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'dept.update', 'department', id, data, request.ip);
    return dept;
  });

  // 删除部门
  fastify.delete('/:id', { preHandler: [requirePermission('dept:delete')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deptService.remove(id);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'dept.delete', 'department', id, {}, request.ip);
      return { message: 'Department removed' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};

export default departmentRoutes;
```

**Step 3: 在 app.ts 中注册路由**

在 `backend/src/app.ts` 中添加：

```typescript
import departmentRoutes from './modules/departments/routes.js';
// ... 在 register 区域添加：
await app.register(departmentRoutes, { prefix: '/api/departments' });
```

**Step 4: Commit**

```bash
git add backend/src/modules/departments/ backend/src/app.ts
git commit -m "feat: add department management API"
```


---

## Task 5: 角色管理后端

**Files:**
- Create: `backend/src/modules/roles/service.ts`
- Create: `backend/src/modules/roles/routes.ts`
- Modify: `backend/src/app.ts` — 注册路由

**Step 1: 创建 RoleService**

`backend/src/modules/roles/service.ts`:

```typescript
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

  async create(data: {
    name: string;
    code: string;
    description?: string;
    dataScope: DataScope;
    allowedProfileTypes?: string[];
    permissionIds: string[];
  }) {
    return this.prisma.role.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        dataScope: data.dataScope,
        allowedProfileTypes: data.allowedProfileTypes || [],
        permissions: {
          create: data.permissionIds.map(pid => ({ permissionId: pid })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    dataScope?: DataScope;
    allowedProfileTypes?: string[];
    permissionIds?: string[];
  }) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    if (role.isSystem && data.permissionIds !== undefined) {
      // 系统角色允许修改权限，但不允许删除角色本身
    }
    // 如果传了 permissionIds，先删后建
    if (data.permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.rolePermission.createMany({
        data: data.permissionIds.map(pid => ({ roleId: id, permissionId: pid })),
      });
    }
    const { permissionIds, ...updateData } = data;
    return this.prisma.role.update({
      where: { id },
      data: updateData,
      include: { permissions: { include: { permission: true } } },
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    if (role.isSystem) throw new Error('系统预置角色不可删除');
    const userCount = await this.prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) throw new Error('该角色下有关联用户，无法删除');
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    return this.prisma.role.delete({ where: { id } });
  }
}
```

**Step 2: 创建权限列表 API 和角色路由**

`backend/src/modules/roles/routes.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { RoleService } from './service.js';
import { AuditService } from '../audit/service.js';
import { requirePermission } from '../../middleware/authenticate.js';

const roleRoutes: FastifyPluginAsync = async (fastify) => {
  const roleService = new RoleService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  // 获取所有权限点（按模块分组）
  fastify.get('/permissions', { preHandler: [requirePermission('role:read')] }, async () => {
    const permissions = await fastify.prisma.permission.findMany({ orderBy: { sortOrder: 'asc' } });
    // 按 module 分组
    const grouped: Record<string, any[]> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return grouped;
  });

  // 角色列表
  fastify.get('/', { preHandler: [requirePermission('role:read')] }, async () => {
    return roleService.list();
  });

  // 单个角色
  fastify.get('/:id', { preHandler: [requirePermission('role:read')] }, async (request) => {
    const { id } = request.params as { id: string };
    return roleService.getById(id);
  });

  // 创建角色
  fastify.post('/', {
    preHandler: [requirePermission('role:write')],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'code', 'dataScope', 'permissionIds'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          code: { type: 'string', minLength: 1, maxLength: 50 },
          description: { type: 'string', maxLength: 200 },
          dataScope: { type: 'string', enum: ['all', 'department_and_children', 'department', 'self'] },
          allowedProfileTypes: { type: 'array', items: { type: 'string' } },
          permissionIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
    },
  }, async (request) => {
    const data = request.body as any;
    const role = await roleService.create(data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'role.create', 'role', role.id, { name: data.name }, request.ip);
    return role;
  });

  // 更新角色
  fastify.put('/:id', { preHandler: [requirePermission('role:write')] }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const role = await roleService.update(id, data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'role.update', 'role', id, data, request.ip);
    return role;
  });

  // 删除角色
  fastify.delete('/:id', { preHandler: [requirePermission('role:delete')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await roleService.remove(id);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'role.delete', 'role', id, {}, request.ip);
      return { message: 'Role removed' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};

export default roleRoutes;
```

**Step 3: 在 app.ts 中注册**

```typescript
import roleRoutes from './modules/roles/routes.js';
await app.register(roleRoutes, { prefix: '/api/roles' });
```

**Step 4: Commit**

```bash
git add backend/src/modules/roles/ backend/src/app.ts
git commit -m "feat: add role management API with permission assignment"
```


---

## Task 6: Auth 模块改造

**Files:**
- Modify: `backend/src/modules/auth/service.ts`
- Modify: `backend/src/modules/auth/routes.ts`

**Step 1: 改造 AuthService**

主要变更：
1. `login` — 查询时 include role + permissions，返回权限列表
2. `createUser` — 接收 roleId, departmentId 替代 role 枚举
3. `getUserById` (即 /me) — 返回完整的角色、权限、部门信息
4. `listUsers` — 支持按部门筛选，受 dataScope 限制
5. `updateUser` — 支持修改 roleId, departmentId

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildDataScopeFilter, getDepartmentAndChildrenIds } from '../../middleware/data-scope.js';

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        department: true,
      },
    });
    if (!user) throw new Error('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');
    const permissions = user.role.permissions.map(rp => rp.permission.code);
    return {
      id: user.id, email: user.email, name: user.name,
      role: { id: user.role.id, code: user.role.code, name: user.role.name, dataScope: user.role.dataScope },
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
      permissions,
    };
  }

  async createUser(data: { email: string; name: string; password: string; roleId: string; departmentId?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Email already exists');
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.user.create({
      data: {
        email: data.email, name: data.name, passwordHash,
        roleId: data.roleId, departmentId: data.departmentId,
      },
      select: { id: true, email: true, name: true, role: true, department: true, createdAt: true },
    });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        department: true,
      },
    });
    if (!user) return null;
    return {
      id: user.id, email: user.email, name: user.name,
      role: { id: user.role.id, code: user.role.code, name: user.role.name, dataScope: user.role.dataScope },
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
      permissions: user.role.permissions.map(rp => rp.permission.code),
      createdAt: user.createdAt,
    };
  }

  async listUsers(
    page = 1, limit = 20,
    sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc',
    filters?: { departmentId?: string; roleId?: string; search?: string },
    // dataScope 参数用于数据范围过滤
    currentUser?: { id: string; dataScope: string; departmentId: string | null },
  ) {
    const where: any = {};

    // 按部门筛选
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.roleId) where.roleId = filters.roleId;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // dataScope 过滤
    if (currentUser && currentUser.dataScope !== 'all') {
      if (currentUser.dataScope === 'department_and_children' && currentUser.departmentId) {
        const deptIds = await getDepartmentAndChildrenIds(this.prisma, currentUser.departmentId);
        where.departmentId = { in: deptIds };
      } else if (currentUser.dataScope === 'department' && currentUser.departmentId) {
        where.departmentId = currentUser.departmentId;
      } else if (currentUser.dataScope === 'self') {
        where.id = currentUser.id;
      }
    }

    const allowedSort = ['createdAt', 'name', 'email'];
    const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, createdAt: true,
          role: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total, page, limit };
  }

  async updateUser(id: string, data: { name?: string; roleId?: string; departmentId?: string | null }) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, name: true, createdAt: true,
        role: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  // changePassword 和 deleteUser 保持不变
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async deleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) throw new Error('Cannot delete yourself');
    await this.prisma.user.delete({ where: { id } });
  }
}
```

**Step 2: 改造 Auth Routes**

主要变更：
1. `POST /login` — JWT payload 增加 role.code，返回 permissions
2. `GET /me` — 返回完整权限信息
3. `GET /users` — 改用 requirePermission('user:read')，传入 dataScope 过滤
4. `POST /register` — 改用 requirePermission('user:write')，接收 roleId/departmentId
5. `PUT /users/:id` — 改用 requirePermission('user:write')
6. `DELETE /users/:id` — 改用 requirePermission('user:delete')

JWT sign payload 改为：
```typescript
const token = fastify.jwt.sign(
  { id: user.id, email: user.email, roleCode: user.role.code },
  { expiresIn: '24h' }
);
```

路由 preHandler 从 `requireRole('super_admin')` 改为对应的 `requirePermission(...)`.

**Step 3: Commit**

```bash
git add backend/src/modules/auth/
git commit -m "feat: refactor auth module for RBAC - permissions, dataScope, department"
```


---

## Task 7: 现有模块适配 — 设备/资产/配置文件路由权限改造

**Files:**
- Modify: `backend/src/modules/devices/routes.ts`
- Modify: `backend/src/modules/devices/service.ts`
- Modify: `backend/src/modules/assets/routes.ts`
- Modify: `backend/src/modules/assets/service.ts`
- Modify: `backend/src/modules/profiles/routes.ts`
- Modify: `backend/src/modules/profiles/service.ts`
- Modify: `backend/src/modules/audit/routes.ts`
- Modify: `backend/src/modules/reports/routes.ts`

**Step 1: 设备路由 — 替换 authenticate 为 requirePermission**

`backend/src/modules/devices/routes.ts`:

```typescript
// 替换 addHook('preHandler', authenticate) 为按路由设置权限
// GET / 和 GET /:id → requirePermission('device:read')
// PUT /:id → requirePermission('device:write')
// DELETE /:id → requirePermission('device:delete')
// GET /:id/commands → requirePermission('device:read')
// POST /:id/commands → requirePermission('mdm:command')
```

同时在 GET / 中增加 dataScope 过滤：
```typescript
fastify.get('/', { preHandler: [requirePermission('device:read')] }, async (request) => {
  const { page, limit, deviceType, enrollmentStatus, search, sortBy, sortOrder } = request.query as any;
  const userRole = (request as any).userRole;
  const userDeptId = (request as any).userDepartmentId;
  const userId = (request.user as any).id;
  return deviceService.list(
    parseInt(page) || 1, parseInt(limit) || 20,
    { deviceType, enrollmentStatus, search },
    sortBy, sortOrder,
    { dataScope: userRole.dataScope, departmentId: userDeptId, userId }
  );
});
```

**Step 2: DeviceService.list 增加 dataScope 参数**

在 `backend/src/modules/devices/service.ts` 的 `list` 方法中增加 dataScope 过滤逻辑：

```typescript
async list(
  page = 1, limit = 20, filters?: DeviceFilters,
  sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc',
  scopeCtx?: { dataScope: string; departmentId: string | null; userId: string }
) {
  const where: any = {};
  // ... 现有 filter 逻辑不变 ...

  // dataScope 过滤 — 通过 asset.department 关联部门
  if (scopeCtx && scopeCtx.dataScope !== 'all') {
    if (scopeCtx.dataScope === 'department_and_children' && scopeCtx.departmentId) {
      const deptIds = await getDepartmentAndChildrenIds(this.prisma, scopeCtx.departmentId);
      where.asset = { ...where.asset, departmentId: { in: deptIds } };
    } else if (scopeCtx.dataScope === 'department' && scopeCtx.departmentId) {
      where.asset = { ...where.asset, departmentId: scopeCtx.departmentId };
    } else if (scopeCtx.dataScope === 'self') {
      where.asset = { ...where.asset, assignedTo: scopeCtx.userId };
    }
  }
  // ... 其余查询逻辑不变 ...
}
```

注意：Asset 表的 department 字段目前是 String 类型（部门名称），需要改为 departmentId FK 关联 Department 表。这是一个 schema 变更，在 Task 1 的 schema 中需要同步处理：

在 Asset model 中：
- 移除 `department String?`
- 新增 `departmentId String? @map("department_id")`
- 新增 `department Department? @relation(fields: [departmentId], references: [id])`

**Step 3: 资产路由同理改造**

```typescript
// GET / → requirePermission('asset:read') + dataScope
// GET /:id → requirePermission('asset:read')
// POST / → requirePermission('asset:write')
// PUT /:id → requirePermission('asset:write')
// DELETE /:id → requirePermission('asset:delete')
```

**Step 4: 配置文件路由改造 + allowedProfileTypes 校验**

```typescript
// GET / → requirePermission('profile:read')
// GET /:id → requirePermission('profile:read')
// POST / → requirePermission('profile:write')
// PUT /:id → requirePermission('profile:write')
// DELETE /:id → requirePermission('profile:write')
// POST /:id/install → requirePermission('profile:deploy')
//   在 install 路由中增加 allowedProfileTypes 校验：
fastify.post('/:id/install', { preHandler: [requirePermission('profile:deploy')] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const { deviceId } = request.body as { deviceId: string };
  // 校验 allowedProfileTypes
  const userRole = (request as any).userRole;
  if (userRole.allowedProfileTypes.length > 0) {
    const profile = await profileService.getById(id);
    if (!userRole.allowedProfileTypes.includes(profile.payloadType)) {
      return reply.status(403).send({ error: '当前角色无权下发此类型配置文件' });
    }
  }
  const result = await profileService.installOnDevice(id, deviceId);
  const user = request.user as { id: string };
  await auditService.log(user.id, 'profile.install', 'profile', id, { deviceId }, request.ip);
  return result;
});
```

**Step 5: 审计和报表路由改造**

```typescript
// audit routes: GET / → requirePermission('audit:read')
// report routes: GET / → requirePermission('report:read')
```

**Step 6: app.ts 中 APNs 设置路由改造**

```typescript
// GET /api/settings/apns → requirePermission('settings:read')
// PUT /api/settings/apns → requirePermission('settings:write')
```

**Step 7: Commit**

```bash
git add backend/src/modules/ backend/src/app.ts
git commit -m "feat: apply RBAC permissions to all route modules"
```


---

## Task 8: 前端 — useAuth 改造 + 权限工具

**Files:**
- Modify: `frontend/src/hooks/use-auth.ts`
- Modify: `frontend/src/lib/constants.ts`

**Step 1: 改造 useAuth hook**

扩展 User 接口和 useAuth，增加 permissions 列表和 hasPermission 方法：

```typescript
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface UserRole {
  id: string;
  code: string;
  name: string;
  dataScope: string;
}

interface UserDepartment {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: UserDepartment | null;
  permissions: string[];
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

  const hasPermission = useCallback((code: string) => {
    return user?.permissions?.includes(code) ?? false;
  }, [user]);

  const hasAnyPermission = useCallback((...codes: string[]) => {
    return codes.some(code => user?.permissions?.includes(code));
  }, [user]);

  return { user, loading, login, logout, hasPermission, hasAnyPermission };
}
```

**Step 2: 更新 constants.ts**

移除旧的 ROLE_LABELS（不再需要硬编码角色名映射），新增权限模块映射：

```typescript
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
```

保留 ROLE_LABELS 但改为动态使用（从 API 获取角色列表）。

**Step 3: Commit**

```bash
git add frontend/src/hooks/use-auth.ts frontend/src/lib/constants.ts
git commit -m "feat: extend useAuth with permissions, add permission constants"
```


---

## Task 9: 前端 — 侧边栏权限控制

**Files:**
- Modify: `frontend/src/components/layout/sidebar.tsx`

**Step 1: 侧边栏菜单项增加权限控制和分组**

```typescript
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Smartphone, Package, Shield,
  ScrollText, BarChart3, Settings, Building2, Users, UserCog
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string; // 需要的权限，不设则所有人可见
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: '概览',
    items: [
      { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard, permission: 'dashboard:view' },
    ],
  },
  {
    label: '设备资产',
    items: [
      { href: '/devices', label: '设备管理', icon: Smartphone, permission: 'device:read' },
      { href: '/assets', label: '资产管理', icon: Package, permission: 'asset:read' },
      { href: '/profiles', label: '配置描述文件', icon: Shield, permission: 'profile:read' },
    ],
  },
  {
    label: '组织管理',
    items: [
      { href: '/departments', label: '部门管理', icon: Building2, permission: 'dept:read' },
      { href: '/users', label: '人员管理', icon: Users, permission: 'user:read' },
      { href: '/roles', label: '角色管理', icon: UserCog, permission: 'role:read' },
    ],
  },
  {
    label: '系统',
    items: [
      { href: '/audit-logs', label: '审计日志', icon: ScrollText, permission: 'audit:read' },
      { href: '/reports', label: '报表中心', icon: BarChart3, permission: 'report:read' },
      { href: '/settings', label: '系统设置', icon: Settings, permission: 'settings:read' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  return (
    <aside className="w-64 border-r bg-gray-50/40 min-h-screen p-4">
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold">myDevices</h1>
        <p className="text-sm text-muted-foreground">Apple 设备管理</p>
      </div>
      <nav className="space-y-6">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            item => !item.permission || hasPermission(item.permission)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => (
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
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/layout/sidebar.tsx
git commit -m "feat: sidebar with permission-based menu groups"
```


---

## Task 10: 前端 — 部门管理页面

**Files:**
- Create: `frontend/src/app/(dashboard)/departments/page.tsx`

**Step 1: 创建部门管理页面**

树形展示部门，支持增删改。使用递归组件渲染树形结构。

核心功能：
1. 加载部门树 `GET /api/departments/tree`
2. 创建部门 — Dialog 表单（名称、编码、上级部门下拉）
3. 编辑部门 — Dialog 表单
4. 删除部门 — 确认 Dialog
5. 树形缩进展示，显示每个部门的人数

```typescript
'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface Department {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  sortOrder: number;
  _count: { users: number };
  children: Department[];
}

// 递归树节点组件
function DeptTreeNode({ dept, level, allDepts, onEdit, onDelete, canWrite, canDelete }: {
  dept: Department; level: number; allDepts: Department[];
  onEdit: (d: Department) => void; onDelete: (d: Department) => void;
  canWrite: boolean; canDelete: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = dept.children && dept.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-2 hover:bg-gray-50 rounded-md group"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        <button onClick={() => setExpanded(!expanded)} className="w-5 h-5 flex items-center justify-center">
          {hasChildren ? (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="w-4" />}
        </button>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1">{dept.name}</span>
        <span className="text-xs text-muted-foreground">{dept.code}</span>
        <span className="text-xs text-muted-foreground">{dept._count.users} 人</span>
        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
          {canWrite && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(dept)}>
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(dept)}>
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          )}
        </div>
      </div>
      {expanded && hasChildren && dept.children.map(child => (
        <DeptTreeNode key={child.id} dept={child} level={level + 1} allDepts={allDepts}
          onEdit={onEdit} onDelete={onDelete} canWrite={canWrite} canDelete={canDelete} />
      ))}
    </div>
  );
}

export default function DepartmentsPage() {
  const { hasPermission } = useAuth();
  const [tree, setTree] = useState<Department[]>([]);
  const [flatList, setFlatList] = useState<Department[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', code: '', parentId: '' });
  const [message, setMessage] = useState('');

  const canWrite = hasPermission('dept:write');
  const canDelete = hasPermission('dept:delete');

  const loadTree = () => {
    api.get('/api/departments/tree').then(res => setTree(res.data)).catch(() => {});
    api.get('/api/departments').then(res => setFlatList(res.data)).catch(() => {});
  };

  useEffect(() => { loadTree(); }, []);

  const handleCreate = async () => {
    try {
      await api.post('/api/departments', {
        name: form.name, code: form.code,
        parentId: form.parentId || undefined,
      });
      setShowCreate(false);
      setForm({ name: '', code: '', parentId: '' });
      loadTree();
    } catch { setMessage('创建失败'); }
  };

  const handleEdit = async () => {
    if (!editDept) return;
    try {
      await api.put(`/api/departments/${editDept.id}`, {
        name: form.name, code: form.code,
        parentId: form.parentId || null,
      });
      setEditDept(null);
      loadTree();
    } catch { setMessage('更新失败'); }
  };

  const handleDelete = async () => {
    if (!deleteDept) return;
    try {
      await api.delete(`/api/departments/${deleteDept.id}`);
      setDeleteDept(null);
      loadTree();
    } catch (err: any) {
      setMessage(err.response?.data?.error || '删除失败');
      setDeleteDept(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">部门管理</h1>
        {canWrite && (
          <Button onClick={() => { setForm({ name: '', code: '', parentId: '' }); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-2" />新建部门
          </Button>
        )}
      </div>
      {message && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md">{message}</div>}
      <Card>
        <CardHeader><CardTitle>组织架构</CardTitle></CardHeader>
        <CardContent>
          {tree.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无部门数据</p>
          ) : (
            tree.map(dept => (
              <DeptTreeNode key={dept.id} dept={dept} level={0} allDepts={flatList}
                onEdit={(d) => { setEditDept(d); setForm({ name: d.name, code: d.code, parentId: d.parentId || '' }); }}
                onDelete={(d) => setDeleteDept(d)}
                canWrite={canWrite} canDelete={canDelete} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建部门</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">部门名称</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">部门编码</label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">上级部门</label>
              <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">无（顶级部门）</option>
                {flatList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDept} onOpenChange={open => { if (!open) setEditDept(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑部门</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">部门名称</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">部门编码</label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">上级部门</label>
              <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">无（顶级部门）</option>
                {flatList.filter(d => d.id !== editDept?.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDept(null)}>取消</Button>
            <Button onClick={handleEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDept} onOpenChange={open => { if (!open) setDeleteDept(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle></DialogHeader>
          <p className="text-sm py-2">确定要删除部门「{deleteDept?.name}」吗？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDept(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/\(dashboard\)/departments/
git commit -m "feat: add department management page with tree view"
```


---

## Task 11: 前端 — 人员管理页面

**Files:**
- Create: `frontend/src/app/(dashboard)/users/page.tsx`

**Step 1: 创建人员管理页面**

从设置页迁移用户管理功能到独立页面，增强为：
1. 用户列表 — 显示姓名、邮箱、角色名、部门名
2. 按部门/角色筛选
3. 创建用户 — 选择角色（从 API 获取）和部门（从 API 获取）
4. 编辑用户 — 修改姓名、角色、部门
5. 删除用户

```typescript
'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filters, setFilters] = useState({ departmentId: '', roleId: '', search: '' });

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteUser, setDeleteUser] = useState<any>(null);
  const [form, setForm] = useState({ email: '', name: '', password: '', roleId: '', departmentId: '' });
  const [message, setMessage] = useState('');

  const canWrite = hasPermission('user:write');
  const canDelete = hasPermission('user:delete');

  const loadUsers = () => {
    const params: any = { page, limit: 20 };
    if (filters.departmentId) params.departmentId = filters.departmentId;
    if (filters.roleId) params.roleId = filters.roleId;
    if (filters.search) params.search = filters.search;
    api.get('/api/auth/users', { params }).then(res => {
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
    }).catch(() => {});
  };

  const loadMeta = () => {
    api.get('/api/roles').then(res => setRoles(res.data)).catch(() => {});
    api.get('/api/departments').then(res => setDepartments(res.data)).catch(() => {});
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadUsers(); }, [page, filters]);

  const handleCreate = async () => {
    try {
      await api.post('/api/auth/register', {
        email: form.email, name: form.name, password: form.password,
        roleId: form.roleId, departmentId: form.departmentId || undefined,
      });
      setShowCreate(false);
      setForm({ email: '', name: '', password: '', roleId: '', departmentId: '' });
      loadUsers();
    } catch (err: any) {
      setMessage(err.response?.data?.error || '创建失败');
    }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      await api.put(`/api/auth/users/${editUser.id}`, {
        name: form.name,
        roleId: form.roleId,
        departmentId: form.departmentId || null,
      });
      setEditUser(null);
      loadUsers();
    } catch { setMessage('编辑失败'); }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      await api.delete(`/api/auth/users/${deleteUser.id}`);
      setDeleteUser(null);
      loadUsers();
    } catch { setMessage('删除失败'); }
  };

  // 页面渲染：筛选栏 + 用户表格 + 分页 + 创建/编辑/删除 Dialog
  // 筛选栏：部门下拉、角色下拉、搜索框
  // 表格列：姓名、邮箱、角色（Badge）、部门、创建时间、操作
  // 创建 Dialog：邮箱、姓名、密码、角色下拉（从 roles 列表）、部门下拉（从 departments 列表）
  // 编辑 Dialog：姓名、角色下拉、部门下拉
  // 删除 Dialog：确认提示

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">人员管理</h1>
        {canWrite && (
          <Button onClick={() => {
            setForm({ email: '', name: '', password: '', roleId: roles[0]?.id || '', departmentId: '' });
            setShowCreate(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />新建用户
          </Button>
        )}
      </div>

      {message && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md">{message}</div>}

      {/* 筛选栏 */}
      <div className="flex gap-4">
        <select value={filters.departmentId} onChange={e => setFilters(f => ({ ...f, departmentId: e.target.value }))}
          className="border rounded-md px-3 py-2 text-sm">
          <option value="">全部部门</option>
          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filters.roleId} onChange={e => setFilters(f => ({ ...f, roleId: e.target.value }))}
          className="border rounded-md px-3 py-2 text-sm">
          <option value="">全部角色</option>
          {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索姓名或邮箱..." className="pl-9"
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>
      </div>

      {/* 用户表格 */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-3 text-left">姓名</th>
                <th className="p-3 text-left">邮箱</th>
                <th className="p-3 text-left">角色</th>
                <th className="p-3 text-left">部门</th>
                <th className="p-3 text-left">创建时间</th>
                <th className="p-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className="border-b">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3"><Badge>{u.role?.name || '-'}</Badge></td>
                  <td className="p-3">{u.department?.name || '-'}</td>
                  <td className="p-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 flex gap-1">
                    {canWrite && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditUser(u);
                        setForm({ ...form, name: u.name, roleId: u.role?.id || '', departmentId: u.department?.id || '' });
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteUser(u)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 分页 */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
          <Button variant="outline" size="sm" disabled={users.length < 20} onClick={() => setPage(p => p + 1)}>下一页</Button>
        </div>
      </div>

      {/* Create/Edit/Delete Dialogs — 结构与部门管理类似 */}
      {/* 创建 Dialog: email, name, password, roleId 下拉, departmentId 下拉 */}
      {/* 编辑 Dialog: name, roleId 下拉, departmentId 下拉 */}
      {/* 删除 Dialog: 确认提示 */}
      {/* ... Dialog 实现省略，结构同 Task 10 ... */}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/\(dashboard\)/users/
git commit -m "feat: add users management page with role/department filters"
```


---

## Task 12: 前端 — 角色管理页面

**Files:**
- Create: `frontend/src/app/(dashboard)/roles/page.tsx`

**Step 1: 创建角色管理页面**

核心功能：
1. 角色列表 — 显示名称、编码、数据范围、关联用户数、是否系统角色
2. 创建角色 — Dialog 表单：名称、编码、描述、数据范围下拉、权限勾选矩阵（按模块分组）、允许的配置文件类型多选
3. 编辑角色 — 同创建表单，预填数据
4. 删除角色 — 系统角色不可删，有关联用户不可删

权限勾选矩阵的实现：
- 从 `GET /api/roles/permissions` 获取按模块分组的权限列表
- 每个模块一行，该模块下的权限点作为 checkbox
- 提供「全选/取消全选」按钮

```typescript
// 关键组件结构：

// PermissionMatrix 组件
function PermissionMatrix({ groupedPermissions, selectedIds, onChange }: {
  groupedPermissions: Record<string, { id: string; code: string; name: string }[]>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const togglePermission = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };
  const toggleModule = (modulePerms: { id: string }[]) => {
    const ids = modulePerms.map(p => p.id);
    const allSelected = ids.every(id => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter(id => !ids.includes(id)));
    } else {
      onChange([...new Set([...selectedIds, ...ids])]);
    }
  };
  const selectAll = () => {
    const allIds = Object.values(groupedPermissions).flat().map(p => p.id);
    onChange(allIds);
  };
  const clearAll = () => onChange([]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={selectAll}>全选</Button>
        <Button variant="outline" size="sm" onClick={clearAll}>清空</Button>
      </div>
      {Object.entries(groupedPermissions).map(([module, perms]) => (
        <div key={module} className="border rounded-md p-3">
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox"
              checked={perms.every(p => selectedIds.includes(p.id))}
              onChange={() => toggleModule(perms)} />
            <span className="text-sm font-medium">{PERMISSION_MODULES[module] || module}</span>
          </div>
          <div className="flex flex-wrap gap-3 ml-6">
            {perms.map(p => (
              <label key={p.id} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={selectedIds.includes(p.id)}
                  onChange={() => togglePermission(p.id)} />
                {p.name}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

页面主体：角色列表卡片 + 创建/编辑 Dialog（包含 PermissionMatrix）+ 删除确认 Dialog。

创建/编辑 Dialog 表单字段：
- 名称 (Input)
- 编码 (Input, 创建时可编辑，编辑时只读)
- 描述 (Input)
- 数据范围 (select: all/department_and_children/department/self)
- 允许的配置文件类型 (多选 checkbox，可选值从现有 Profile 的 payloadType 去重获取，或手动输入)
- 权限矩阵 (PermissionMatrix 组件)

**Step 2: Commit**

```bash
git add frontend/src/app/\(dashboard\)/roles/page.tsx
git commit -m "feat: add role management page with permission matrix"
```

---

## Task 13: 前端 — 设置页改造

**Files:**
- Modify: `frontend/src/app/(dashboard)/settings/page.tsx`

**Step 1: 移除用户管理 tab**

从设置页中移除「用户管理」TabsTrigger 和 TabsContent，只保留：
- APNs 证书
- 系统信息

用户管理功能已迁移到独立的 `/users` 页面。

**Step 2: Commit**

```bash
git add frontend/src/app/\(dashboard\)/settings/page.tsx
git commit -m "refactor: remove user management from settings, now at /users"
```

---

## Task 14: 前端 — Header 显示角色和部门信息

**Files:**
- Modify: `frontend/src/components/layout/header.tsx`

**Step 1: Header 显示当前用户角色和部门**

在 Header 组件中，除了显示用户名，还显示角色名和部门名：

```typescript
// 从 useAuth 获取 user 对象
// 显示: user.name | user.role.name | user.department?.name
```

**Step 2: Commit**

```bash
git add frontend/src/components/layout/header.tsx
git commit -m "feat: show role and department in header"
```

---

## Task 15: 前端 — 现有页面权限适配

**Files:**
- Modify: `frontend/src/app/(dashboard)/devices/page.tsx`
- Modify: `frontend/src/app/(dashboard)/devices/[id]/page.tsx`
- Modify: `frontend/src/app/(dashboard)/assets/page.tsx`
- Modify: `frontend/src/app/(dashboard)/assets/[id]/page.tsx`
- Modify: `frontend/src/app/(dashboard)/profiles/page.tsx`
- Modify: `frontend/src/app/(dashboard)/audit-logs/page.tsx`

**Step 1: 各页面增加按钮级权限控制**

在各页面中使用 `useAuth().hasPermission()` 控制操作按钮的显示：

- 设备页：编辑按钮需 `device:write`，删除按钮需 `device:delete`，命令按钮需 `mdm:command`
- 资产页：创建/编辑按钮需 `asset:write`，删除按钮需 `asset:delete`
- 配置文件页：创建/编辑按钮需 `profile:write`，下发按钮需 `profile:deploy`
- 审计日志页：只读，无需额外控制

**Step 2: Commit**

```bash
git add frontend/src/app/
git commit -m "feat: add button-level permission control to existing pages"
```

---

## Task 16: 最终验证和清理

**Step 1: 重置数据库并运行 seed**

```bash
cd backend && npx prisma migrate reset --force
```

**Step 2: 验证功能**

1. 用 admin@mydevices.local 登录 — 应看到所有菜单和功能
2. 用 deviceadmin@mydevices.local 登录 — 应看到设备/资产/配置相关菜单，不应看到组织管理
3. 用 viewer@mydevices.local 登录 — 应只看到只读菜单，无编辑/删除按钮
4. 测试部门管理 CRUD
5. 测试角色管理 — 创建新角色，勾选权限，分配给用户
6. 测试数据范围隔离 — 不同部门的用户看到不同数据

**Step 3: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete RBAC + org management system"
```

---

## 执行顺序总结

| Task | 内容 | 依赖 |
|------|------|------|
| 1 | Prisma Schema 改造 | 无 |
| 2 | Seed 脚本改造 | Task 1 |
| 3 | 后端中间件改造 | Task 1 |
| 4 | 部门管理后端 | Task 1, 3 |
| 5 | 角色管理后端 | Task 1, 3 |
| 6 | Auth 模块改造 | Task 1, 3 |
| 7 | 现有模块适配 | Task 3, 6 |
| 8 | 前端 useAuth 改造 | Task 6 |
| 9 | 侧边栏权限控制 | Task 8 |
| 10 | 部门管理页面 | Task 4, 8 |
| 11 | 人员管理页面 | Task 6, 8 |
| 12 | 角色管理页面 | Task 5, 8 |
| 13 | 设置页改造 | Task 11 |
| 14 | Header 改造 | Task 8 |
| 15 | 现有页面权限适配 | Task 8 |
| 16 | 最终验证 | 全部 |

