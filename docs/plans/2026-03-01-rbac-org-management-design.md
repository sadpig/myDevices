# 组织架构 + RBAC 权限系统设计

日期：2026-03-01
状态：已批准

## 概述

为 myDevices 系统增加公司部门管理、人员管理、角色权限管理功能。采用经典 RBAC 模型（方案 A），支持树形多级部门、动态角色、可配置权限、部门级数据隔离、配置文件下发类型控制。

## 数据模型

### 新增表

#### Department（部门）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| name | String | 部门名称 |
| code | String unique | 部门编码 |
| parentId | UUID? FK→Department | 上级部门，null=顶级 |
| sortOrder | Int default(0) | 排序 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### Role（角色）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| name | String | 角色名称 |
| code | String unique | 角色编码 |
| description | String? | 描述 |
| dataScope | DataScope enum | 数据范围 |
| allowedProfileTypes | String[] | 可下发的 payloadType，空=全部 |
| isSystem | Boolean default(false) | 系统预置不可删 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### Permission（权限点）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| code | String unique | 如 device:read |
| name | String | 显示名 |
| module | String | 功能模块分组 |
| sortOrder | Int default(0) | |

#### RolePermission（角色-权限关联）
| 字段 | 类型 | 说明 |
|------|------|------|
| roleId | UUID FK→Role | |
| permissionId | UUID FK→Permission | |
| @@unique([roleId, permissionId]) | |

### 改造 User 表
- 移除 `role: UserRole` 枚举字段
- 新增 `roleId: UUID FK→Role`（必填）
- 新增 `departmentId: UUID? FK→Department`（可选）
- 移除 `UserRole` 枚举类型

### 新增枚举
```
enum DataScope {
  all                     // 全部数据
  department_and_children // 本部门及下级
  department              // 仅本部门
  self                    // 仅自己
}
```

## 权限点清单

| 模块 | code | 显示名 |
|------|------|--------|
| dashboard | dashboard:view | 查看仪表盘 |
| device | device:read | 查看设备 |
| device | device:write | 编辑设备 |
| device | device:delete | 删除设备 |
| asset | asset:read | 查看资产 |
| asset | asset:write | 编辑资产 |
| asset | asset:delete | 删除资产 |
| profile | profile:read | 查看配置文件 |
| profile | profile:write | 编辑配置文件 |
| profile | profile:deploy | 下发配置文件 |
| mdm | mdm:command | 下发 MDM 命令 |
| audit | audit:read | 查看审计日志 |
| report | report:read | 查看报表 |
| user | user:read | 查看人员 |
| user | user:write | 编辑人员 |
| user | user:delete | 删除人员 |
| department | dept:read | 查看部门 |
| department | dept:write | 编辑部门 |
| department | dept:delete | 删除部门 |
| role | role:read | 查看角色 |
| role | role:write | 编辑角色 |
| role | role:delete | 删除角色 |
| settings | settings:read | 查看设置 |
| settings | settings:write | 编辑设置 |

## 数据范围控制

Role.dataScope 决定用户查询设备/资产/人员时的数据过滤：
- `all`：不过滤
- `department_and_children`：用户所在部门及所有下级部门的数据
- `department`：仅用户所在部门的数据
- `self`：仅用户自己创建/被分配的数据

后端实现：在 service 层查询时，根据当前用户的 dataScope 和 departmentId 构建 Prisma where 条件。

## Profile 下发控制

Role.allowedProfileTypes 存储该角色可下发的 payloadType 列表。
- 空数组 `[]` 表示允许全部类型
- 下发配置时后端校验当前用户角色的 allowedProfileTypes

## 预置角色（seed）

| 角色 | code | dataScope | 权限 | allowedProfileTypes |
|------|------|-----------|------|---------------------|
| 超级管理员 | super_admin | all | 全部 | [] |
| 设备管理员 | device_admin | department_and_children | device/asset/profile/mdm 读写 + dashboard/audit/report 读 | [] |
| 只读用户 | readonly | department | 所有模块 read 权限 | [] |

## 迁移策略

1. 创建新表 Department, Role, Permission, RolePermission
2. seed 预置权限点和 3 个系统角色
3. User 表新增 roleId（先可选），departmentId
4. 迁移脚本：根据旧 User.role 枚举值关联到对应预置角色
5. roleId 改为必填，删除旧 role 字段和 UserRole 枚举

## 后端 API

### 部门管理 /api/departments
- GET / — 获取部门树
- POST / — 创建部门
- PUT /:id — 更新部门
- DELETE /:id — 删除部门（需无子部门和人员）

### 角色管理 /api/roles
- GET / — 角色列表（含权限）
- POST / — 创建角色
- PUT /:id — 更新角色（含权限配置）
- DELETE /:id — 删除角色（非系统角色，需无关联用户）

### 权限 /api/permissions
- GET / — 获取全部权限点（按模块分组）

### 人员管理（改造 /api/auth）
- GET /users — 人员列表（支持按部门筛选，受 dataScope 限制）
- POST /register — 创建人员（增加 roleId, departmentId）
- PUT /users/:id — 更新人员
- GET /me — 返回用户信息 + 权限列表 + 部门信息

## 前端变更

### 侧边栏
新增「组织管理」分组：
- 部门管理 /departments
- 人员管理 /users
- 角色管理 /roles

菜单项根据用户权限动态显示/隐藏。

### 新页面
- /departments — 树形部门管理（增删改，拖拽排序可选）
- /users — 人员列表（筛选部门，分配角色/部门）
- /roles — 角色管理（权限勾选矩阵，数据范围配置，Profile 类型配置）

### 权限守卫
- 登录后 /api/auth/me 返回完整权限列表
- 前端 useAuth hook 提供 hasPermission(code) 方法
- 侧边栏、按钮、页面级权限控制

### 设置页
- 移除用户管理 tab（迁移到独立 /users 页面）
- 保留 APNs 和系统信息 tab

## 现有模块适配

- devices/assets service 查询增加 dataScope 过滤
- profiles deploy 增加 allowedProfileTypes 校验
- authenticate 中间件改为从 Role 读取权限
- requireRole 改为 requirePermission
