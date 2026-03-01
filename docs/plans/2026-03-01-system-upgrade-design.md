# myDevices 系统全面升级设计文档

> 日期：2026-03-01
> 状态：已批准

## 概述

对 myDevices MDM 系统进行全面升级：激活部门/角色权限体系、资产管理流程改造、通知系统、i18n 国际化、代码审查与 Bug 修复。

## 用户确认的需求

1. 管理员核心流程：增加资产 - 配置部门 - 选择人员 - 设定角色/位置/状态/备注 - 用户收到邮件
2. 通知方式：系统内通知 + 真实邮件（SMTP），邮件作为可选配置
3. 部门管理：树形部门结构（多级，支持 parentId）
4. 国际化：多语言框架（i18next），中文为主，可扩展
5. 执行策略：按模块逐个完善

## 现状问题

| # | 问题 | 影响 |
|---|------|------|
| 1 | Department/Role/Permission 表存在但未使用 | 权限控制是硬编码字符串 |
| 2 | Asset.assignedTo/department 是纯文本 | 无法关联用户和部门 |
| 3 | shared/types/index.ts 与 Prisma schema 不同步 | User 缺少 roleId/departmentId |
| 4 | 无通知系统 | 资产分配后无法通知用户 |
| 5 | requireRole() 硬编码角色名 | 无法动态管理权限 |
| 6 | BigInt 序列化未处理 | storageCapacity 返回前端会报错 |
| 7 | .env writeFileSync 无锁 | 并发写入可能损坏文件 |
| 8 | 分页实现不一致 | 审计日志 vs 其他页面分页逻辑不同 |

## 模块设计

### 模块 1：基础设施层

Schema 新增 Notification 模型。shared/types 与 Prisma schema 同步。后端添加 nodemailer 邮件服务、通知服务。前端 api.ts 统一错误处理。BigInt JSON 序列化全局处理。

### 模块 2：部门管理（新模块）

后端 `backend/src/modules/departments/` — CRUD + 树形查询。
前端 `/settings` 新增「部门管理」tab — 树形展示、增删改。
API：GET/POST/PUT/DELETE /api/departments，GET /api/departments/tree。

### 模块 3：角色权限（激活已有模型）

后端 `backend/src/modules/roles/` — Role CRUD + 权限分配。
前端 `/settings` 新增「角色管理」tab — 权限勾选矩阵。
中间件 requireRole() 改为 requirePermission()，查 DB + Redis 缓存。
seed.ts 初始化默认权限集（device/asset/profile/user/department/role/audit/report/settings）。

### 模块 4：用户管理升级

用户表单增加部门树选择器 + 角色下拉。列表显示部门和角色名称。新增管理员重置密码功能。

### 模块 5：资产管理升级

Schema 变更：assignedTo(string) 改为 assignedToId(FK User)，department(string) 改为 departmentId(FK Department)。数据迁移按姓名/名称匹配。创建/更新资产时触发通知。前端表单改为部门树选择器 + 用户选择器。

### 模块 6：设备管理优化

搜索增加 UDID。BigInt storageCapacity 修复。命令历史分页优化。

### 模块 7：配置描述文件优化

新建页面增加 payload 模板选择器（WiFi/VPN/Email/Restrictions）。详情页 JSON 语法高亮。

### 模块 8：通知系统

后端 `backend/src/modules/notifications/` — 创建/列表/标记已读/未读计数。
前端 Header 增加通知铃铛 + 未读 badge + 下拉列表。
Settings 新增「邮件配置」tab（SMTP 设置 + 测试发送）。
资产分配时自动创建系统通知 + 发送邮件。

### 模块 9：审计日志增强

增加日期范围筛选、目标类型筛选。修复分页显示总页数。统一分页逻辑。

### 模块 10：i18n 国际化框架

搭建 react-i18next 基础结构。创建 zh.json/en.json。所有页面硬编码中文替换为 t() 调用。Header 增加语言切换器。

### 模块 11：全局代码审查和 Bug 修复

已知 Bug：BigInt 序列化、.env 无锁写入、分页不一致、JWT role 硬编码、UserRole enum 残留。
代码审查：XSS 防护、SQL 注入检查、错误处理统一、代码风格统一。

## 文件变更清单

### 新建文件
- backend/src/modules/departments/ (service.ts, routes.ts)
- backend/src/modules/roles/ (service.ts, routes.ts)
- backend/src/modules/notifications/ (service.ts, routes.ts)
- backend/src/services/mail.ts
- backend/src/services/notification.ts
- frontend/src/i18n/config.ts
- frontend/src/i18n/locales/zh.json
- frontend/src/i18n/locales/en.json

### 修改文件（后端）
- backend/prisma/schema.prisma — Notification 模型, Asset FK 变更
- backend/prisma/seed.ts — 权限初始化, 部门树种子数据
- backend/src/app.ts — 注册新路由, BigInt 序列化, 统一错误处理
- backend/src/middleware/authenticate.ts — requirePermission() 改造
- backend/src/modules/auth/service.ts — 用户增加 departmentId/roleId
- backend/src/modules/auth/routes.ts — 用户路由更新
- backend/src/modules/assets/service.ts — FK 关联, 通知触发
- backend/src/modules/assets/routes.ts — 更新参数
- backend/src/modules/devices/service.ts — UDID 搜索, BigInt 处理
- backend/src/modules/audit/service.ts — 日期范围筛选

### 修改文件（前端）
- frontend/src/app/(dashboard)/settings/page.tsx — 部门/角色/邮件 tab
- frontend/src/app/(dashboard)/assets/new/page.tsx — 部门树+用户选择器
- frontend/src/app/(dashboard)/assets/[id]/page.tsx — FK 关联展示
- frontend/src/app/(dashboard)/devices/page.tsx — UDID 搜索
- frontend/src/app/(dashboard)/devices/[id]/page.tsx — BigInt 修复
- frontend/src/app/(dashboard)/profiles/new/page.tsx — 模板选择器
- frontend/src/app/(dashboard)/audit-logs/page.tsx — 筛选+分页修复
- frontend/src/components/layout/header.tsx — 通知铃铛+语言切换
- frontend/src/lib/api.ts — 统一错误处理
- shared/types/index.ts — 全面同步

## 执行顺序

模块 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11（有依赖关系，必须按序）
