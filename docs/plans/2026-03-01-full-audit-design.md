# myDevices 全面审计与优化设计文档

日期: 2026-03-01

## 概述

对 myDevices（Apple 设备管理系统）进行全面代码审计、Bug 修复、功能扩充和性能优化。

---

## 一、Bug 修复（15 项）

### 后端严重 Bug

#### B1: APNs topic 错误
- 文件: `backend/src/modules/mdm/apns.ts:87`
- 问题: `apns-topic` 使用了 `pushMagic`，应该使用 MDM 证书 topic
- 修复: 在 APNsConfig 中增加 `topic` 字段，从环境变量 `APNS_TOPIC` 读取

#### B2: 缺少 plist 解析器
- 文件: `backend/src/app.ts`
- 问题: MDM 设备发送 plist 格式数据，Fastify 无法解析
- 修复: 安装 `plist` 包，注册 `application/x-apple-aspen-mdm-checkin` 和 `application/x-apple-aspen-mdm` content-type parser

#### B3: 设备命令路由绕过 APNs
- 文件: `backend/src/modules/devices/routes.ts`
- 问题: `POST /:id/commands` 直接写 DB，不触发 APNs 推送
- 修复: 改用 `CommandService.queueCommand()`

#### B4: MDM connect 状态映射错误
- 文件: `backend/src/modules/mdm/routes.ts`
- 问题: `NotNow` 和未知状态都映射为 `acknowledged`
- 修复: 正确映射 `NotNow` → `not_now`，未知状态 → `error`

#### B5: 登出无效
- 文件: `backend/src/modules/auth/routes.ts`
- 问题: JWT 无状态，登出是空操作
- 修复: 利用已有 Redis 实现 token 黑名单，authenticate 中间件检查黑名单

#### B6: 不安全的环境变量 fallback
- 文件: `backend/src/app.ts`, `backend/src/plugins/prisma.ts`
- 问题: JWT_SECRET 和 DATABASE_URL 有硬编码 fallback
- 修复: 生产环境缺少必要变量时抛出错误，仅开发环境允许 fallback

#### B7: seed.ts bcrypt cost 不一致
- 文件: `backend/prisma/seed.ts`
- 修复: 统一为 cost 12

### 前端严重 Bug

#### B8: 设置页用户列表 API 调用错误
- 文件: `frontend/src/app/(dashboard)/settings/page.tsx`
- 问题: `loadUsers()` 调用 `/api/auth/me` 而非 `/api/auth/users`
- 修复: 改为调用 `/api/auth/users`

#### B9: 认证逻辑重复
- 文件: `frontend/src/app/(dashboard)/layout.tsx`, `frontend/src/hooks/use-auth.ts`
- 修复: layout 复用 `use-auth` hook

#### B10: 搜索无防抖
- 文件: `frontend/src/app/(dashboard)/devices/page.tsx`, `assets/page.tsx`
- 修复: 添加 300ms 防抖

#### B11: 401 硬跳转
- 文件: `frontend/src/lib/api.ts`
- 问题: `window.location.href = '/login'` 丢失 React 状态
- 修复: 使用事件机制通知 auth hook 处理跳转

#### B12: 分页逻辑不准确
- 文件: 多个列表页面
- 修复: 使用后端返回的 total 计算总页数

#### B13: 所有数据类型为 any[]
- 修复: 在 `shared/types/index.ts` 定义完整类型，前后端共用

#### B14: 审计日志永远为空
- 修复: 在所有关键路由中调用 `AuditService.log()`（登录、设备操作、命令下发、用户管理等）

#### B15: 缺少 MDM enrollment profile 端点
- 修复: 添加 `GET /mdm/enroll` 端点，生成并返回 `.mobileconfig` 文件

---

## 二、依赖清理与升级

### 清理未使用依赖
- 后端: 移除 `bullmq`（未使用），启用 `@fastify/swagger`
- 前端: 启用 `@tanstack/react-table`（替换原生 table）、`react-hook-form` + `zod`（替换手动表单验证）

### 启用已安装但未使用的模块
- `@fastify/swagger` → 注册并生成 API 文档
- `@tanstack/react-table` → 设备和资产列表使用
- `react-hook-form` + `zod` → 所有表单使用
- Redis → token 黑名单 + 报表缓存

---

## 三、功能扩充

### F1: 完整的 MDM 注册流程
- enrollment profile 生成端点
- plist 解析支持

### F2: Token 黑名单（Redis）
- 登出时将 token 加入 Redis 黑名单
- authenticate 中间件检查黑名单
- TTL 与 token 过期时间一致（24h）

### F3: 审计日志接入
- 登录/登出
- 用户创建/删除
- 设备命令下发
- 配置文件安装/删除
- 资产创建/更新/删除

### F4: 缺失的 CRUD 端点
- `DELETE /api/profiles/:id`
- `DELETE /api/assets/:id`

### F5: 报表导出
- CSV 导出功能

### F6: 后端输入验证
- 所有路由使用 Fastify JSON Schema 验证

### F7: Swagger API 文档
- 注册 @fastify/swagger，自动生成文档

---

## 四、性能优化

### O1: 数据库索引
```prisma
// MDMCommand
@@index([deviceId, status])

// Device
@@index([enrollmentStatus])
@@index([deviceType])
```

### O2: 报表查询并行化 + Redis 缓存
- 并行执行独立查询
- Redis 缓存 60s TTL

### O3: 前端数据缓存
- 使用 SWR 或 React Query 替代手动 fetch
- 消除重复请求

### O4: 搜索防抖
- 300ms 防抖

### O5: 图表数据 useMemo
- 避免每次渲染重新计算

### O6: 常量提取
- `statusLabels`、`DEVICE_ICONS` 等提取到 `lib/constants.ts`

---

## 五、安全加固

### S1: 生产环境变量检查
- JWT_SECRET、DATABASE_URL 必须设置

### S2: Token 黑名单
- 见 F2

### S3: 输入验证
- 见 F6

### S4: .gitignore 更新
- 添加 `*.p8` 防止 APNs 密钥泄露

---

## 实施顺序

1. **Phase 1 — 基础修复**: B1-B7（后端 bug）、依赖清理、类型定义（B13）
2. **Phase 2 — 前端修复**: B8-B12、启用 react-hook-form/zod/react-table
3. **Phase 3 — 功能扩充**: F1-F7、审计日志接入（B14-B15）
4. **Phase 4 — 优化**: O1-O6、安全加固 S1-S4
