# 主题切换 + 国际化 + iOS 26 毛玻璃风格设计

日期: 2026-03-01

## 概述

为 myDevices MDM 管理系统添加：
1. Dark/Light 主题切换（含跟随系统）
2. 中文/英文语言切换
3. iOS 26 风格的全局毛玻璃（Glassmorphism）UI 重设计
4. 用户偏好后端持久化

## 技术选型

| 功能 | 方案 | 理由 |
|------|------|------|
| 主题切换 | `next-themes` | 专为 Next.js 设计，零 FOUC，处理 SSR hydration |
| 国际化 | `i18next` + `react-i18next` | 成熟生态，项目全 client component 适配简单 |
| 毛玻璃风格 | CSS 变量 + `backdrop-filter` 工具类 | 与现有 shadcn 体系兼容，改动集中在 CSS 层 |
| 偏好存储 | localStorage + 后端 PATCH 同步 | 跨设备一致体验 |

## 新增依赖

```
next-themes
i18next
react-i18next
```

## 架构

### Provider 嵌套（app/layout.tsx）

```
<ThemeProvider>           ← next-themes, attribute="class"
  <LanguageProvider>      ← i18next 初始化
    <PreferencesProvider> ← 登录后同步偏好到后端
      {children}
    </PreferencesProvider>
  </LanguageProvider>
</ThemeProvider>
```

### 新增文件

```
frontend/src/
├── providers/
│   ├── theme-provider.tsx
│   ├── language-provider.tsx
│   └── preferences-provider.tsx
├── i18n/
│   ├── config.ts
│   ├── zh.json
│   └── en.json
├── components/layout/
│   ├── theme-toggle.tsx
│   └── language-toggle.tsx
```

## 主题系统

### next-themes 配置

- `attribute="class"` — 在 `<html>` 切换 `.dark` class
- `defaultTheme="system"` — 默认跟随系统
- `storageKey="mydevices-theme"`

### iOS 26 毛玻璃色彩方案

Light 模式：
```css
:root {
  --background: oklch(0.97 0.005 270);
  --card: oklch(1 0 0 / 60%);
  --popover: oklch(1 0 0 / 70%);
  --sidebar: oklch(1 0 0 / 40%);
  --border: oklch(1 0 0 / 30%);
  /* 其余变量保持或微调 */
}
```

Dark 模式：
```css
.dark {
  --background: oklch(0.13 0.01 270);
  --card: oklch(0.2 0.01 270 / 50%);
  --popover: oklch(0.2 0.01 270 / 60%);
  --sidebar: oklch(0.15 0.01 270 / 50%);
  --border: oklch(1 0 0 / 8%);
}
```

### 毛玻璃工具类

```css
.glass {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
.glass-subtle {
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
}
```

### 背景渐变（提供透视效果）

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(ellipse at 20% 50%, oklch(0.92 0.03 270 / 40%) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, oklch(0.92 0.03 200 / 30%) 0%, transparent 50%),
    var(--background);
}
```

### 应用位置

| 组件 | 效果 |
|------|------|
| Sidebar | `glass` + 半透明背景 + `border-r border-white/10` |
| Header | `glass-subtle` + 半透明背景 + `border-b border-white/10` |
| Card | `glass-subtle` + 半透明背景 + 圆角 `xl` |
| Dialog/Popover | `glass` + 半透明背景 |

## 国际化

### i18next 配置

- `lng`: 默认 `zh`
- `fallbackLng`: `zh`
- 资源：`zh.json`, `en.json`

### 翻译 key 结构（扁平化）

```json
{
  "common.loading": "加载中...",
  "common.logout": "退出",
  "common.search": "搜索",
  "common.prev": "上一页",
  "common.next": "下一页",
  "common.noData": "暂无数据",
  "common.total": "共 {{count}} 条",
  "common.page": "第 {{current}}/{{total}} 页",
  "common.details": "详情",
  "common.edit": "编辑",
  "common.delete": "删除",
  "common.save": "保存",
  "common.cancel": "取消",
  "common.confirm": "确认",
  "common.allTypes": "全部类型",
  "common.allStatus": "全部状态",

  "sidebar.title": "myDevices",
  "sidebar.subtitle": "Apple 设备管理",
  "sidebar.dashboard": "仪表盘",
  "sidebar.devices": "设备管理",
  "sidebar.assets": "资产管理",
  "sidebar.profiles": "配置描述文件",
  "sidebar.auditLogs": "审计日志",
  "sidebar.reports": "报表中心",
  "sidebar.settings": "系统设置",

  "devices.title": "设备管理",
  "devices.total": "共 {{count}} 台设备",
  "devices.searchPlaceholder": "搜索设备名称、序列号...",
  "devices.name": "设备名称",
  "devices.type": "类型",
  "devices.serial": "序列号",
  "devices.osVersion": "系统版本",
  "devices.status": "注册状态",
  "devices.lastOnline": "最后在线",
  "devices.noDevices": "暂无设备",

  "assets.title": "资产管理",
  "profiles.title": "配置描述文件",
  "audit.title": "审计日志",
  "reports.title": "报表中心",
  "settings.title": "系统设置",

  "login.title": "登录",
  "login.email": "邮箱",
  "login.password": "密码",
  "login.submit": "登录",

  "dashboard.title": "仪表盘"
}
```

### 改造方式

每个页面中的硬编码字符串替换为 `t('key')`，使用 `useTranslation()` hook。

## 后端偏好存储

### Prisma schema 变更

```prisma
model User {
  // ... existing fields
  preferences Json @default("{}")
}
```

### preferences JSON 结构

```json
{
  "theme": "light" | "dark" | "system",
  "language": "zh" | "en"
}
```

### API

- `GET /api/users/me` — 返回中加入 `preferences` 字段
- `PATCH /api/users/me/preferences` — 更新偏好

### 前端同步逻辑（PreferencesProvider）

1. 登录成功后从 `/api/users/me` 获取 preferences
2. 应用到 `next-themes` 和 `i18next`
3. 用户切换时立即本地生效 + debounce 300ms 后 PATCH 到后端
4. 未登录时仅用 localStorage

## UI 组件改造

### Header

- 右侧布局：`[语言切换] [主题切换] [用户名] [退出]`
- 语言切换：`中/En` 文字按钮
- 主题切换：Sun/Moon 图标按钮

### Sidebar

- 半透明 + glass 效果
- hover 态：`bg-white/10`
- 选中态：`bg-white/20` + 左侧 accent 条

### Card

- 背景改为半透明 + `glass-subtle`
- 边框 `border-white/10`

## 影响范围

### 需要修改的文件

- `frontend/src/app/layout.tsx` — 包裹 Providers
- `frontend/src/app/globals.css` — 色彩变量 + 毛玻璃类 + 背景渐变
- `frontend/src/components/layout/sidebar.tsx` — 毛玻璃 + i18n
- `frontend/src/components/layout/header.tsx` — 加切换器 + i18n
- `frontend/src/app/(dashboard)/layout.tsx` — i18n loading 文案
- 所有 `(dashboard)/**/page.tsx` — 硬编码字符串替换为 `t()`
- `frontend/src/app/login/page.tsx` — i18n
- `frontend/src/hooks/use-auth.ts` — 登录后获取 preferences
- `frontend/src/components/ui/card.tsx` — 毛玻璃样式
- `backend/prisma/schema.prisma` — User 加 preferences 字段
- `backend/src/modules/auth/service.ts` — 登录返回 preferences

### 新增文件

- `frontend/src/providers/theme-provider.tsx`
- `frontend/src/providers/language-provider.tsx`
- `frontend/src/providers/preferences-provider.tsx`
- `frontend/src/i18n/config.ts`
- `frontend/src/i18n/zh.json`
- `frontend/src/i18n/en.json`
- `frontend/src/components/layout/theme-toggle.tsx`
- `frontend/src/components/layout/language-toggle.tsx`

### 后端新增

- `PATCH /api/users/me/preferences` 路由 + service 方法
- Prisma migration: add preferences to User
