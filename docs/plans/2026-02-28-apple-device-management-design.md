# Apple 设备管理系统 (myDevices) — 设计文档

> 日期：2026-02-28

## 1. 项目概述

企业级 Apple 设备管理系统，集成 MDM（移动设备管理）协议和资产管理功能。支持全部 6 种 Apple 设备类型（iPhone、iPad、Mac、Apple TV、Apple Watch、Apple Vision Pro），面向 500+ 台设备规模的大型企业。

## 2. 技术栈

| 层面 | 技术 |
|------|------|
| 前端框架 | Next.js 14 + App Router |
| UI 组件 | shadcn/ui + Tailwind CSS |
| 后端框架 | Fastify + TypeScript |
| ORM | Prisma |
| 数据库 | PostgreSQL |
| 缓存/队列 | Redis (BullMQ) |
| 认证 | JWT + bcrypt |
| APNs | HTTP/2 直连 |
| 部署 | Docker Compose |

## 3. 架构设计

模块化单体架构：一个 Fastify 后端（内部按模块划分）+ 独立 Next.js 前端。

```
┌─────────────────────────────────────────────────┐
│                   前端 (Next.js)                  │
│  React + TypeScript + Tailwind CSS + shadcn/ui   │
└──────────────────────┬──────────────────────────┘
                       │ REST API / WebSocket
┌──────────────────────▼──────────────────────────┐
│              后端 (Fastify + TypeScript)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ 用户模块  │ │ 资产模块  │ │   MDM 协议模块    │ │
│  │ 认证/授权 │ │ 设备台账  │ │ APNs / Commands  │ │
│  │ RBAC     │ │ 生命周期  │ │ Profiles / DDM   │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ 通知模块  │ │ 审计模块  │ │   报表模块        │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└───────┬──────────────┬──────────────┬───────────┘
        │              │              │
   PostgreSQL        Redis         APNs
```

### 核心模块

1. **auth** — 管理员认证、RBAC 角色权限（超级管理员、设备管理员、只读用户）
2. **devices** — 设备注册、信息查询、状态追踪，支持 6 种设备类型
3. **assets** — 设备台账、采购信息、分配记录、生命周期管理、保修追踪
4. **mdm** — MDM check-in 端点、命令队列、配置描述文件下发、DDM 声明式管理
5. **notifications** — APNs 集成、系统内通知、告警
6. **audit** — 操作日志、合规审计
7. **reports** — 设备统计、资产报表、合规报告

## 4. 数据模型

### Device
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| udid | String | 设备唯一标识 |
| serial_number | String | 序列号 |
| device_type | Enum | iPhone / iPad / Mac / AppleTV / AppleWatch / VisionPro |
| model | String | 型号标识 |
| model_name | String | 型号名称 |
| os_version | String | 系统版本 |
| build_version | String | 构建版本 |
| device_name | String | 设备名称 |
| product_name | String | 产品名称 |
| storage_capacity | BigInt | 存储容量 |
| wifi_mac | String | WiFi MAC 地址 |
| bluetooth_mac | String | 蓝牙 MAC 地址 |
| enrollment_status | Enum | pending / enrolled / unenrolled |
| last_seen_at | DateTime | 最后在线时间 |
| mdm_enrolled | Boolean | 是否已注册 MDM |
| supervised | Boolean | 是否受监管 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

### Asset
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| device_id | UUID | 关联设备（一对一） |
| purchase_date | DateTime | 采购日期 |
| purchase_price | Decimal | 采购价格 |
| warranty_end | DateTime | 保修截止 |
| assigned_to | String | 分配人 |
| department | String | 部门 |
| location | String | 位置 |
| status | Enum | in_use / in_stock / repairing / retired / lost |
| notes | Text | 备注 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

### User
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| email | String | 邮箱 |
| name | String | 姓名 |
| role | Enum | super_admin / device_admin / readonly |
| password_hash | String | 密码哈希 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

### MDMCommand
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| device_id | UUID | 目标设备 |
| command_type | String | 命令类型 |
| payload | JSON | 命令载荷 |
| status | Enum | queued / sent / acknowledged / error / not_now |
| request_id | String | 请求标识 |
| queued_at | DateTime | 入队时间 |
| sent_at | DateTime | 发送时间 |
| acknowledged_at | DateTime | 确认时间 |
| result | JSON | 执行结果 |

### Profile
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | String | 名称 |
| identifier | String | 标识符 |
| payload_type | String | 载荷类型 |
| payload | JSON | 载荷内容 |
| target_devices | UUID[] | 目标设备列表 |
| description | Text | 描述 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

### AuditLog
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 操作人 |
| action | String | 操作类型 |
| target_type | String | 目标类型 |
| target_id | UUID | 目标 ID |
| details | JSON | 详情 |
| ip_address | String | IP 地址 |
| created_at | DateTime | 创建时间 |

## 5. MDM 协议流程

```
设备                          MDM 服务器                    APNs
 │                               │                          │
 │  1. Enrollment (HTTPS)        │                          │
 │  ──────────────────────────►  │                          │
 │  ◄── 返回 MDM Profile ──────  │                          │
 │                               │                          │
 │  2. Check-in: Authenticate    │                          │
 │  ──────────────────────────►  │                          │
 │  ◄── 确认注册 ──────────────  │                          │
 │                               │                          │
 │                               │  3. Push Notification    │
 │                               │  ─────────────────────►  │
 │  ◄──────────────────────────────── 推送唤醒 ────────────  │
 │                               │                          │
 │  4. Check-in: 获取命令         │                          │
 │  ──────────────────────────►  │                          │
 │  ◄── 返回 MDM Command ──────  │                          │
 │                               │                          │
 │  5. 执行结果上报               │                          │
 │  ──────────────────────────►  │                          │
 │  ◄── 确认/下一条命令 ────────  │                          │
```

## 6. API 设计

### 管理 API（前端调用）

**认证**
- `POST /api/auth/login` — 登录
- `POST /api/auth/logout` — 登出
- `GET  /api/auth/me` — 当前用户

**设备**
- `GET    /api/devices` — 设备列表（分页、筛选、搜索）
- `GET    /api/devices/:id` — 设备详情
- `PUT    /api/devices/:id` — 更新设备
- `DELETE /api/devices/:id` — 移除设备
- `POST   /api/devices/:id/commands` — 下发命令
- `GET    /api/devices/:id/commands` — 命令历史

**资产**
- `GET    /api/assets` — 资产列表
- `GET    /api/assets/:id` — 资产详情
- `POST   /api/assets` — 创建资产
- `PUT    /api/assets/:id` — 更新资产
- `GET    /api/assets/stats` — 资产统计

**配置描述文件**
- `GET    /api/profiles` — 列表
- `POST   /api/profiles` — 创建
- `PUT    /api/profiles/:id` — 更新
- `POST   /api/profiles/:id/install` — 安装到设备

**审计 & 报表**
- `GET /api/audit-logs` — 操作日志
- `GET /api/reports/devices` — 设备报表
- `GET /api/reports/compliance` — 合规报告

### MDM 协议端点（设备侧调用）

- `PUT /mdm/checkin` — Check-in（Authenticate / TokenUpdate / CheckOut）
- `PUT /mdm/connect` — 获取命令 & 上报结果
- `PUT /mdm/enroll` — 设备注册

## 7. 前端页面

```
/login                    — 登录页
/dashboard                — 仪表盘（设备总览、状态统计、告警）
/devices                  — 设备列表
/devices/:id              — 设备详情
/assets                   — 资产列表
/assets/:id               — 资产详情
/assets/new               — 新建资产
/profiles                 — 配置描述文件列表
/profiles/:id             — 描述文件详情
/profiles/new             — 创建描述文件
/audit-logs               — 审计日志
/reports                  — 报表中心
/settings                 — 系统设置
```

## 8. 项目目录结构

```
myDevices/
├── frontend/                    # Next.js 前端
│   ├── src/
│   │   ├── app/                 # App Router 页面
│   │   ├── components/          # 通用组件
│   │   │   ├── ui/              # shadcn/ui
│   │   │   ├── devices/         # 设备组件
│   │   │   ├── assets/          # 资产组件
│   │   │   └── layout/          # 布局组件
│   │   ├── hooks/               # 自定义 hooks
│   │   ├── lib/                 # 工具函数、API client
│   │   └── types/               # 类型定义
│   ├── public/
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                     # Fastify 后端
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── devices/
│   │   │   ├── assets/
│   │   │   ├── mdm/
│   │   │   │   ├── checkin/
│   │   │   │   ├── commands/
│   │   │   │   ├── profiles/
│   │   │   │   └── apns/
│   │   │   ├── audit/
│   │   │   └── reports/
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   └── seeds/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── app.ts
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                      # 前后端共享类型和常量
│   ├── types/
│   └── constants/
│
├── docs/plans/
├── docker-compose.yml
└── README.md
```
