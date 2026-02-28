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
npx prisma migrate dev --name init
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
| admin@mydevices.local | admin123 | 超级管理员 |

## 项目结构

```
myDevices/
├── frontend/          # Next.js 前端
│   └── src/
│       ├── app/       # 页面路由
│       ├── components/# UI 组件
│       ├── hooks/     # 自定义 hooks
│       └── lib/       # 工具函数
├── backend/           # Fastify 后端
│   └── src/
│       ├── modules/   # 功能模块
│       ├── plugins/   # Fastify 插件
│       └── middleware/ # 中间件
├── shared/            # 共享类型
├── docker-compose.yml
└── docs/plans/        # 设计文档
```

## API 概览

- `POST /api/auth/login` — 登录
- `GET /api/devices` — 设备列表
- `GET /api/assets` — 资产列表
- `GET /api/profiles` — 配置描述文件
- `GET /api/audit-logs` — 审计日志
- `GET /api/reports/devices` — 设备报表
- `PUT /mdm/checkin` — MDM 设备签到
- `PUT /mdm/connect` — MDM 命令通道

## License

MIT
