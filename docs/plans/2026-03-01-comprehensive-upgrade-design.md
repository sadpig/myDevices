# myDevices 综合升级设计文档

日期：2026-03-01
状态：已批准

## 概述

对 myDevices MDM 系统进行全面升级，包括：bug 修复、代码质量优化、核心管理员流程闭环、扩展功能、MDM 标准功能（应用管理/内容管理）、重新部署。

## 一、Bug 修复 & 代码质量

### 1.1 权限种子数据修复
- 补充缺失权限：`mdm:command`、`profile:deploy`、`dashboard:view`
- 新增模块权限：`app:read/write/deploy`、`content:read/write/deploy`

### 1.2 错误处理统一化
- 所有路由添加 try/catch，返回 `{ error: string, code: number }`
- GET /:id 返回 404 而非 null+200
- Login 区分 DB 错误和认证失败
- Redis 连接失败时 JWT 黑名单降级处理

### 1.3 类型安全
- 消除所有 `request.body as any`，定义 Fastify schema + TypeScript 类型
- 修复 `listUsers` 的 `dataScope` 参数类型不匹配

### 1.4 i18n 补全
- 补充 `common.select` 等缺失 key
- 修复 assets 页面错误使用 `devices.pageInfo`
- settings 页面硬编码中文替换为 i18n key
- 硬编码 `¥` 替换为 `Intl.NumberFormat`

### 1.5 前端 UI 修复
- Asset 创建表单补充 `retired`/`lost` 状态
- Notes 字段改为 `<textarea>`
- 所有 `<select>` 添加 dark mode 样式
- `<label>` 关联 `htmlFor`/`id`
- 操作成功后添加 toast 提示
- 排序变更时重置分页到第 1 页

### 1.6 安全修复
- 审计路由添加 `audit:read` 权限检查
- 邮件内容 HTML 转义防 XSS
- MDM 命令类型添加枚举校验

## 二、核心管理员流程 & 通知系统

### 2.1 设备选择器（Device Picker）
- 新增 `GET /api/devices/search?q=xxx` 接口
- 前端 deviceId 字段替换为 Combobox 组件
- 显示设备名 + 序列号 + 型号
- 只显示未绑定资产的设备

### 2.2 通知触发点
- 资产分配/变更 assignedToId → 通知被分配用户（站内+邮件）
- 新用户创建 → 欢迎邮件（含初始密码）
- MDM 关键命令（DeviceLock/EraseDevice/ClearPasscode）→ 通知设备关联用户
- 资产状态变更为 lost/retired → 通知原分配用户
- 配置文件安装/卸载 → 通知设备关联用户

### 2.3 邮件模板
- HTML 邮件模板系统（资产分配、欢迎邮件、MDM 命令告警等）
- 模板支持变量替换（用户名、设备名、资产编号等）
- 所有用户输入内容 HTML 转义

### 2.4 系统设置持久化
- 新增 `SystemSetting` 模型（key-value）
- SMTP 配置从 .env 迁移到数据库
- Settings 页面保存写入 DB
- mail.ts 从 DB 读取配置，变更时自动 resetTransporter
- 添加「测试邮件」按钮

## 三、扩展功能

### 3.1 批量操作
- 资产列表多选复选框
- 批量分配：选中 → 选择部门/人员 → 一键分配（触发批量通知）
- 批量状态变更：选中 → 选择目标状态 → 一键更新
- 批量导入：CSV 上传 → 预览 → 确认导入
- 后端：`POST /api/assets/batch-assign`、`POST /api/assets/batch-status`、`POST /api/assets/import`

### 3.2 资产生命周期管理
- 新增 `AssetHistory` 模型：记录状态变更、分配变更
- 新增 `MaintenanceRecord` 模型：维修原因、维修商、费用、日期
- 资产详情页「历史记录」时间线视图
- 保修到期提醒：定时任务检查 30 天内到期保修，生成通知

### 3.3 仪表盘可视化增强
- 资产状态分布饼图
- 设备类型分布柱状图
- 部门资产占比图
- 近 30 天资产变动趋势折线图
- 使用 recharts 库
- 后端 `GET /api/reports/dashboard-stats` 聚合接口

### 3.4 审计日志增强
- 资产转移记录独立视图
- 审计日志支持按操作类型、目标类型、时间范围筛选
- 审计日志导出 CSV
- 审计详情弹窗显示变更前后对比

## 四、MDM 标准功能

### 4.1 应用管理（App Management）

数据模型：
- `App`：bundleId(unique), name, version, icon, size, category, managedApp, source, createdAt
- `AppAssignment`：appId, deviceId?, departmentId?, status(pending/installed/failed/removed), createdAt, updatedAt

功能：
- 应用库页面：列表、搜索、筛选
- 应用详情页：版本信息、已安装设备列表、安装统计
- 应用分发：选择应用 → 选择目标 → 下发 InstallApplication MDM 命令
- 应用卸载：下发 RemoveApplication 命令
- 应用黑白名单：配置 bundleId 列表，关联配置文件
- 后端：`/api/apps` CRUD + `/api/apps/:id/install` + `/api/apps/:id/uninstall`
- 权限：`app:read`、`app:write`、`app:deploy`

### 4.2 内容管理（Content Management）

数据模型：
- `Content`：name, type(document/book/media), fileUrl, fileSize, description, version, createdAt
- `ContentAssignment`：contentId, deviceId?, departmentId?, status, createdAt, updatedAt

功能：
- 内容库页面：上传/管理文档、书籍等
- 内容分发：选择内容 → 选择目标 → 下发 InstallMedia MDM 命令
- 内容移除：下发移除命令
- 内容使用统计
- 文件上传存储：`/uploads` 目录（Docker volume 挂载）
- 后端：`/api/contents` CRUD + `/api/contents/:id/distribute` + `/api/contents/:id/remove`
- 权限：`content:read`、`content:write`、`content:deploy`

### 4.3 侧边栏 & 路由
- 侧边栏新增「应用管理」「内容管理」菜单项
- 前端路由：`/apps`、`/apps/[id]`、`/contents`、`/contents/[id]`
- i18n 补充所有新增 key

## 五、数据库变更

### 新增模型
```
SystemSetting     — key(unique), value, updatedAt
AssetHistory      — assetId, action, fromUserId, toUserId, fromStatus, toStatus, details, createdAt
MaintenanceRecord — assetId, reason, vendor, cost, startDate, endDate, notes, createdAt
App               — bundleId(unique), name, version, icon, size, category, managedApp, source, createdAt
AppAssignment     — appId, deviceId?, departmentId?, status, createdAt, updatedAt
Content           — name, type, fileUrl, fileSize, description, version, createdAt
ContentAssignment — contentId, deviceId?, departmentId?, status, createdAt, updatedAt
```

### 现有模型修改
- Asset 添加 assetHistories、maintenanceRecords 关系
- Device 添加 appAssignments、contentAssignments 关系
- Department 添加 appAssignments、contentAssignments 关系

### 迁移策略
- 单次 prisma migrate dev 生成迁移
- seed.ts 更新：补充缺失权限 + 新模块权限 + 示例数据

## 六、部署

- docker-compose.yml 添加 uploads volume
- 修复 NEXT_PUBLIC_API_URL 环境变量
- 确保 prisma migrate deploy 在容器启动时执行
- 添加健康检查端点 GET /api/health
- TypeScript 编译零错误
- 所有 i18n key 中英文完整
- Docker build + 启动验证
