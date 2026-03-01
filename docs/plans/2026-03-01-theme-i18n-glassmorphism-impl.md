# Theme + i18n + Glassmorphism Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Dark/Light theme switching, Chinese/English i18n, iOS 26 glassmorphism UI, and backend preference sync to the myDevices MDM dashboard.

**Architecture:** Three layered providers (ThemeProvider → LanguageProvider → PreferencesProvider) wrapping the app. CSS variables + backdrop-filter for glassmorphism. i18next for translations. Backend stores preferences in User.preferences JSON field.

**Tech Stack:** next-themes, i18next, react-i18next, Tailwind CSS v4, Prisma, Fastify

---

## Task 1: Install frontend dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install packages**

Run:
```bash
cd frontend && npm install next-themes i18next react-i18next
```

**Step 2: Verify installation**

Run:
```bash
cd frontend && node -e "require('next-themes'); require('i18next'); require('react-i18next'); console.log('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add next-themes, i18next, react-i18next"
```

---

## Task 2: iOS 26 glassmorphism CSS variables + utility classes

**Files:**
- Modify: `frontend/src/app/globals.css`

**Step 1: Replace the `:root` and `.dark` blocks and add glass utilities**

Replace the entire `:root { ... }` block (lines 50-83) with iOS 26 glassmorphism colors:

```css
:root {
  --radius: 0.625rem;
  --background: oklch(0.97 0.005 270);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0 / 60%);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0 / 70%);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.55 0.2 265);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.95 0.01 270 / 60%);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.95 0.005 270 / 50%);
  --muted-foreground: oklch(0.45 0.02 270);
  --accent: oklch(0.93 0.02 270 / 50%);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.5 0.02 270 / 12%);
  --input: oklch(0.5 0.02 270 / 15%);
  --ring: oklch(0.55 0.2 265 / 50%);
  --chart-1: oklch(0.55 0.2 265);
  --chart-2: oklch(0.6 0.15 185);
  --chart-3: oklch(0.55 0.12 145);
  --chart-4: oklch(0.65 0.18 80);
  --chart-5: oklch(0.58 0.2 330);
  --sidebar: oklch(1 0 0 / 40%);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.55 0.2 265);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.55 0.2 265 / 12%);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.5 0.02 270 / 10%);
  --sidebar-ring: oklch(0.55 0.2 265 / 50%);
}
```

Replace the entire `.dark { ... }` block (lines 85-117) with:

```css
.dark {
  --background: oklch(0.13 0.01 270);
  --foreground: oklch(0.93 0.005 270);
  --card: oklch(0.18 0.015 270 / 50%);
  --card-foreground: oklch(0.93 0.005 270);
  --popover: oklch(0.18 0.015 270 / 60%);
  --popover-foreground: oklch(0.93 0.005 270);
  --primary: oklch(0.7 0.18 265);
  --primary-foreground: oklch(0.13 0.01 270);
  --secondary: oklch(0.22 0.015 270 / 50%);
  --secondary-foreground: oklch(0.93 0.005 270);
  --muted: oklch(0.22 0.01 270 / 40%);
  --muted-foreground: oklch(0.65 0.02 270);
  --accent: oklch(0.22 0.02 270 / 50%);
  --accent-foreground: oklch(0.93 0.005 270);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 8%);
  --input: oklch(1 0 0 / 12%);
  --ring: oklch(0.7 0.18 265 / 50%);
  --chart-1: oklch(0.7 0.18 265);
  --chart-2: oklch(0.65 0.15 185);
  --chart-3: oklch(0.6 0.12 145);
  --chart-4: oklch(0.7 0.18 80);
  --chart-5: oklch(0.65 0.2 330);
  --sidebar: oklch(0.15 0.015 270 / 50%);
  --sidebar-foreground: oklch(0.93 0.005 270);
  --sidebar-primary: oklch(0.7 0.18 265);
  --sidebar-primary-foreground: oklch(0.13 0.01 270);
  --sidebar-accent: oklch(0.7 0.18 265 / 12%);
  --sidebar-accent-foreground: oklch(0.93 0.005 270);
  --sidebar-border: oklch(1 0 0 / 6%);
  --sidebar-ring: oklch(0.7 0.18 265 / 50%);
}
```

**Step 2: Add glass utility classes and background gradient**

After the `.dark { ... }` block, before `@layer base`, add:

```css
/* iOS 26 Glassmorphism utilities */
.glass {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
.glass-subtle {
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
}
```

Replace the `@layer base` block with:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 20% 50%, oklch(0.85 0.05 270 / 30%) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, oklch(0.85 0.05 200 / 20%) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 80%, oklch(0.85 0.04 330 / 15%) 0%, transparent 50%),
      var(--background);
  }
  .dark body::before {
    background:
      radial-gradient(ellipse at 20% 50%, oklch(0.3 0.05 270 / 25%) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, oklch(0.3 0.05 200 / 15%) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 80%, oklch(0.3 0.04 330 / 10%) 0%, transparent 50%),
      var(--background);
  }
}
```

**Step 3: Verify no CSS syntax errors**

Run:
```bash
cd frontend && npx tailwindcss --input src/app/globals.css --output /dev/null 2>&1 | head -5
```

**Step 4: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "style: iOS 26 glassmorphism CSS variables and utilities"
```

---

## Task 3: ThemeProvider with next-themes

**Files:**
- Create: `frontend/src/providers/theme-provider.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Step 1: Create ThemeProvider**

Create `frontend/src/providers/theme-provider.tsx`:

```tsx
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="mydevices-theme"
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
```

**Step 2: Wrap layout with ThemeProvider**

Modify `frontend/src/app/layout.tsx`. The root layout is a server component, so we need to add `suppressHydrationWarning` to `<html>` (required by next-themes) and wrap children:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "myDevices - Apple 设备管理系统",
  description: "企业级 Apple 设备管理与 MDM 解决方案",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 3: Create ThemeToggle component**

Create `frontend/src/components/layout/theme-toggle.tsx`:

```tsx
'use client';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <Button variant="ghost" size="icon" className="h-8 w-8" disabled><Sun className="h-4 w-4" /></Button>;

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const Icon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-full"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
    >
      <Icon className="h-4 w-4 transition-transform" />
    </Button>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/src/providers/theme-provider.tsx frontend/src/components/layout/theme-toggle.tsx frontend/src/app/layout.tsx
git commit -m "feat: add ThemeProvider and ThemeToggle component"
```

---

## Task 4: i18n setup with i18next

**Files:**
- Create: `frontend/src/i18n/config.ts`
- Create: `frontend/src/i18n/zh.json`
- Create: `frontend/src/i18n/en.json`
- Create: `frontend/src/providers/language-provider.tsx`
- Create: `frontend/src/components/layout/language-toggle.tsx`

**Step 1: Create i18next config**

Create `frontend/src/i18n/config.ts`:

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './zh.json';
import en from './en.json';

const savedLang = typeof window !== 'undefined'
  ? localStorage.getItem('mydevices-language') || 'zh'
  : 'zh';

i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh }, en: { translation: en } },
  lng: savedLang,
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
});

export default i18n;
```

**Step 2: Create Chinese translation file**

Create `frontend/src/i18n/zh.json`:

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
  "common.saving": "保存中...",
  "common.cancel": "取消",
  "common.confirm": "确认",
  "common.allTypes": "全部类型",
  "common.allStatus": "全部状态",
  "common.back": "返回",
  "common.actions": "操作",
  "common.create": "创建",
  "common.creating": "创建中...",
  "common.exportCsv": "导出 CSV",
  "common.exportFailed": "导出失败",
  "common.to": "至",
  "common.new": "新建",
  "common.confirmDelete": "确认删除",
  "common.yes": "是",
  "common.no": "否",

  "app.title": "myDevices",
  "app.subtitle": "Apple 设备管理",
  "app.fullTitle": "myDevices - Apple 设备管理系统",
  "app.description": "企业级 Apple 设备管理与 MDM 解决方案",

  "sidebar.dashboard": "仪表盘",
  "sidebar.devices": "设备管理",
  "sidebar.assets": "资产管理",
  "sidebar.profiles": "配置描述文件",
  "sidebar.auditLogs": "审计日志",
  "sidebar.reports": "报表中心",
  "sidebar.settings": "系统设置",

  "login.title": "登录",
  "login.email": "邮箱",
  "login.password": "密码",
  "login.submit": "登录",
  "login.submitting": "登录中...",
  "login.error": "邮箱或密码错误",

  "dashboard.title": "仪表盘",
  "dashboard.totalDevices": "设备总数",
  "dashboard.enrolled": "已注册",
  "dashboard.pending": "待注册",
  "dashboard.deviceTypeDistribution": "设备类型分布",
  "dashboard.enrollmentStatus": "注册状态",
  "dashboard.recentDevices": "最近设备",
  "dashboard.deviceName": "设备名称",
  "dashboard.type": "类型",
  "dashboard.serial": "序列号",
  "dashboard.osVersion": "系统版本",
  "dashboard.status": "状态",
  "dashboard.noDevices": "暂无设备",

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
  "devices.pageInfo": "共 {{total}} 台 · 第 {{page}}/{{pages}} 页",
  "devices.supervised": "受监管",
  "devices.deleteConfirm": "确定要删除设备 \"{{name}}\" 吗？此操作不可撤销。",

  "enrollment.pending": "待注册",
  "enrollment.enrolled": "已注册",
  "enrollment.unenrolled": "已注销",

  "assets.title": "资产管理",
  "assets.new": "新建资产",
  "assets.searchPlaceholder": "搜索分配人、位置、序列号...",
  "assets.device": "设备",
  "assets.serial": "序列号",
  "assets.assignedTo": "分配人",
  "assets.department": "部门",
  "assets.status": "状态",
  "assets.warrantyEnd": "保修截止",
  "assets.createdAt": "创建时间",
  "assets.noAssets": "暂无资产",
  "assets.detail": "资产详情",
  "assets.info": "资产信息",
  "assets.notes": "备注",
  "assets.deleteConfirm": "确定要删除此资产记录吗？此操作不可撤销。",
  "assets.deviceId": "设备 ID",
  "assets.deviceUuid": "设备 UUID",
  "assets.purchaseDate": "采购日期",
  "assets.purchasePrice": "采购价格",
  "assets.location": "位置",
  "assets.createFailed": "创建失败，请检查输入",

  "assetStatus.in_use": "使用中",
  "assetStatus.in_stock": "库存",
  "assetStatus.repairing": "维修中",
  "assetStatus.retired": "已退役",
  "assetStatus.lost": "丢失",

  "profiles.title": "配置描述文件",
  "profiles.searchPlaceholder": "搜索名称、标识符...",
  "profiles.name": "名称",
  "profiles.identifier": "标识符",
  "profiles.payloadType": "负载类型",
  "profiles.deviceCount": "设备数",
  "profiles.createdAt": "创建时间",
  "profiles.noProfiles": "暂无配置描述文件",
  "profiles.pageInfo": "共 {{total}} 个 · 第 {{page}} 页",
  "profiles.unit": " 台",

  "audit.title": "审计日志",
  "audit.filterAction": "按操作类型筛选...",
  "audit.allTargetTypes": "全部目标类型",
  "audit.time": "时间",
  "audit.operator": "操作人",
  "audit.action": "操作",
  "audit.targetType": "目标类型",
  "audit.targetId": "目标 ID",
  "audit.ipAddress": "IP 地址",
  "audit.noLogs": "暂无日志",
  "audit.pageInfo": "共 {{total}} 条 · 第 {{page}} 页",

  "reports.title": "报表中心",
  "reports.mdmEnrollRate": "MDM 注册率",
  "reports.supervisionRate": "监管率",
  "reports.assetCoverageRate": "资产覆盖率",
  "reports.deviceReport": "设备报表",
  "reports.assetReport": "资产报表",
  "reports.deviceStats": "设备统计",
  "reports.deviceTypeDistribution": "设备类型分布",
  "reports.assetStats": "资产统计",
  "reports.assetStatusDistribution": "资产状态分布",
  "reports.departmentDistribution": "部门分布 (Top 10)",
  "reports.unassigned": "未分配",

  "settings.title": "系统设置",
  "settings.userCreated": "用户创建成功",
  "settings.createFailed": "创建失败",
  "settings.editFailed": "编辑失败",
  "settings.deleteUserConfirm": "确定要删除用户 \"{{name}}\" 吗？",

  "commandStatus.queued": "排队中",
  "commandStatus.sent": "已发送",
  "commandStatus.acknowledged": "已确认",
  "commandStatus.error": "错误",
  "commandStatus.not_now": "稍后",

  "roles.super_admin": "超级管理员",
  "roles.device_admin": "设备管理员",
  "roles.readonly": "只读用户"
}
```

**Step 3: Create English translation file**

Create `frontend/src/i18n/en.json`:

```json
{
  "common.loading": "Loading...",
  "common.logout": "Logout",
  "common.search": "Search",
  "common.prev": "Previous",
  "common.next": "Next",
  "common.noData": "No data",
  "common.total": "{{count}} total",
  "common.page": "Page {{current}}/{{total}}",
  "common.details": "Details",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.save": "Save",
  "common.saving": "Saving...",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.allTypes": "All types",
  "common.allStatus": "All status",
  "common.back": "Back",
  "common.actions": "Actions",
  "common.create": "Create",
  "common.creating": "Creating...",
  "common.exportCsv": "Export CSV",
  "common.exportFailed": "Export failed",
  "common.to": "to",
  "common.new": "New",
  "common.confirmDelete": "Confirm Delete",
  "common.yes": "Yes",
  "common.no": "No",

  "app.title": "myDevices",
  "app.subtitle": "Apple Device Management",
  "app.fullTitle": "myDevices - Apple Device Management",
  "app.description": "Enterprise Apple Device Management & MDM Solution",

  "sidebar.dashboard": "Dashboard",
  "sidebar.devices": "Devices",
  "sidebar.assets": "Assets",
  "sidebar.profiles": "Profiles",
  "sidebar.auditLogs": "Audit Logs",
  "sidebar.reports": "Reports",
  "sidebar.settings": "Settings",

  "login.title": "Login",
  "login.email": "Email",
  "login.password": "Password",
  "login.submit": "Login",
  "login.submitting": "Logging in...",
  "login.error": "Invalid email or password",

  "dashboard.title": "Dashboard",
  "dashboard.totalDevices": "Total Devices",
  "dashboard.enrolled": "Enrolled",
  "dashboard.pending": "Pending",
  "dashboard.deviceTypeDistribution": "Device Type Distribution",
  "dashboard.enrollmentStatus": "Enrollment Status",
  "dashboard.recentDevices": "Recent Devices",
  "dashboard.deviceName": "Device Name",
  "dashboard.type": "Type",
  "dashboard.serial": "Serial Number",
  "dashboard.osVersion": "OS Version",
  "dashboard.status": "Status",
  "dashboard.noDevices": "No devices",

  "devices.title": "Devices",
  "devices.total": "{{count}} devices",
  "devices.searchPlaceholder": "Search device name, serial number...",
  "devices.name": "Device Name",
  "devices.type": "Type",
  "devices.serial": "Serial Number",
  "devices.osVersion": "OS Version",
  "devices.status": "Enrollment Status",
  "devices.lastOnline": "Last Online",
  "devices.noDevices": "No devices",
  "devices.pageInfo": "{{total}} total · Page {{page}}/{{pages}}",
  "devices.supervised": "Supervised",
  "devices.deleteConfirm": "Are you sure you want to delete device \"{{name}}\"? This action cannot be undone.",

  "enrollment.pending": "Pending",
  "enrollment.enrolled": "Enrolled",
  "enrollment.unenrolled": "Unenrolled",

  "assets.title": "Assets",
  "assets.new": "New Asset",
  "assets.searchPlaceholder": "Search assignee, location, serial...",
  "assets.device": "Device",
  "assets.serial": "Serial Number",
  "assets.assignedTo": "Assigned To",
  "assets.department": "Department",
  "assets.status": "Status",
  "assets.warrantyEnd": "Warranty End",
  "assets.createdAt": "Created At",
  "assets.noAssets": "No assets",
  "assets.detail": "Asset Detail",
  "assets.info": "Asset Information",
  "assets.notes": "Notes",
  "assets.deleteConfirm": "Are you sure you want to delete this asset? This action cannot be undone.",
  "assets.deviceId": "Device ID",
  "assets.deviceUuid": "Device UUID",
  "assets.purchaseDate": "Purchase Date",
  "assets.purchasePrice": "Purchase Price",
  "assets.location": "Location",
  "assets.createFailed": "Creation failed, please check input",

  "assetStatus.in_use": "In Use",
  "assetStatus.in_stock": "In Stock",
  "assetStatus.repairing": "Repairing",
  "assetStatus.retired": "Retired",
  "assetStatus.lost": "Lost",

  "profiles.title": "Profiles",
  "profiles.searchPlaceholder": "Search name, identifier...",
  "profiles.name": "Name",
  "profiles.identifier": "Identifier",
  "profiles.payloadType": "Payload Type",
  "profiles.deviceCount": "Devices",
  "profiles.createdAt": "Created At",
  "profiles.noProfiles": "No profiles",
  "profiles.pageInfo": "{{total}} total · Page {{page}}",
  "profiles.unit": "",

  "audit.title": "Audit Logs",
  "audit.filterAction": "Filter by action type...",
  "audit.allTargetTypes": "All target types",
  "audit.time": "Time",
  "audit.operator": "Operator",
  "audit.action": "Action",
  "audit.targetType": "Target Type",
  "audit.targetId": "Target ID",
  "audit.ipAddress": "IP Address",
  "audit.noLogs": "No logs",
  "audit.pageInfo": "{{total}} total · Page {{page}}",

  "reports.title": "Reports",
  "reports.mdmEnrollRate": "MDM Enrollment Rate",
  "reports.supervisionRate": "Supervision Rate",
  "reports.assetCoverageRate": "Asset Coverage Rate",
  "reports.deviceReport": "Device Report",
  "reports.assetReport": "Asset Report",
  "reports.deviceStats": "Device Statistics",
  "reports.deviceTypeDistribution": "Device Type Distribution",
  "reports.assetStats": "Asset Statistics",
  "reports.assetStatusDistribution": "Asset Status Distribution",
  "reports.departmentDistribution": "Department Distribution (Top 10)",
  "reports.unassigned": "Unassigned",

  "settings.title": "Settings",
  "settings.userCreated": "User created successfully",
  "settings.createFailed": "Creation failed",
  "settings.editFailed": "Edit failed",
  "settings.deleteUserConfirm": "Are you sure you want to delete user \"{{name}}\"?",

  "commandStatus.queued": "Queued",
  "commandStatus.sent": "Sent",
  "commandStatus.acknowledged": "Acknowledged",
  "commandStatus.error": "Error",
  "commandStatus.not_now": "Not Now",

  "roles.super_admin": "Super Admin",
  "roles.device_admin": "Device Admin",
  "roles.readonly": "Read Only"
}
```

**Step 4: Create LanguageProvider**

Create `frontend/src/providers/language-provider.tsx`:

```tsx
'use client';
import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import i18n from '@/i18n/config';
import { I18nextProvider } from 'react-i18next';

type Language = 'zh' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'zh',
  setLanguage: () => {},
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('mydevices-language') as Language) || 'zh';
    }
    return 'zh';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('mydevices-language', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </LanguageContext.Provider>
  );
}
```

**Step 5: Create LanguageToggle component**

Create `frontend/src/components/layout/language-toggle.tsx`:

```tsx
'use client';
import { useLanguage } from '@/providers/language-provider';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 rounded-full px-2 text-xs font-medium gap-1"
      onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
      aria-label="Switch language"
    >
      <Languages className="h-3.5 w-3.5" />
      {language === 'zh' ? 'En' : '中'}
    </Button>
  );
}
```

**Step 6: Add LanguageProvider to layout**

Modify `frontend/src/app/layout.tsx` — add LanguageProvider inside ThemeProvider:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { LanguageProvider } from "@/providers/language-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "myDevices - Apple 设备管理系统",
  description: "企业级 Apple 设备管理与 MDM 解决方案",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 7: Commit**

```bash
git add frontend/src/i18n/ frontend/src/providers/language-provider.tsx frontend/src/components/layout/language-toggle.tsx frontend/src/app/layout.tsx
git commit -m "feat: add i18n with i18next, LanguageProvider, and LanguageToggle"
```

---

## Task 5: Backend — Add preferences field to User model

**Files:**
- Modify: `backend/prisma/schema.prisma` (line 47-57, User model)
- Modify: `backend/src/modules/auth/service.ts`
- Modify: `backend/src/modules/auth/routes.ts`

**Step 1: Add preferences field to User model**

In `backend/prisma/schema.prisma`, add a `preferences` field to the User model (after line 54, before `auditLogs`):

```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  name         String
  role         UserRole  @default(readonly)
  passwordHash String    @map("password_hash")
  preferences  Json      @default("{}")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  auditLogs    AuditLog[]
  @@map("users")
}
```

**Step 2: Generate migration**

Run:
```bash
cd backend && npx prisma migrate dev --name add_user_preferences
```

**Step 3: Update AuthService to include preferences in all user queries**

In `backend/src/modules/auth/service.ts`:

Update the `login` method (line 12) to also return preferences:
```ts
return { id: user.id, email: user.email, name: user.name, role: user.role, preferences: user.preferences };
```

Update `getUserById` (line 26-29) select to include preferences:
```ts
select: { id: true, email: true, name: true, role: true, createdAt: true, preferences: true },
```

Add a new method `updatePreferences` at the end of the class (before closing `}`):
```ts
async updatePreferences(userId: string, preferences: { theme?: string; language?: string }) {
  const allowed = { theme: preferences.theme, language: preferences.language };
  // Remove undefined keys
  Object.keys(allowed).forEach(k => (allowed as any)[k] === undefined && delete (allowed as any)[k]);
  const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const current = (user.preferences as Record<string, unknown>) || {};
  const merged = { ...current, ...allowed };
  return this.prisma.user.update({
    where: { id: userId },
    data: { preferences: merged },
    select: { id: true, preferences: true },
  });
}
```

**Step 4: Add PATCH /me/preferences route**

In `backend/src/modules/auth/routes.ts`, add after the `GET /me` route (after line 53):

```ts
fastify.patch('/me/preferences', {
  preHandler: [authenticate],
  schema: {
    body: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['light', 'dark', 'system'] },
        language: { type: 'string', enum: ['zh', 'en'] },
      },
    },
  },
}, async (request) => {
  const { id } = request.user as { id: string };
  const prefs = request.body as { theme?: string; language?: string };
  return authService.updatePreferences(id, prefs);
});
```

**Step 5: Commit**

```bash
git add backend/prisma/ backend/src/modules/auth/
git commit -m "feat: add user preferences field and PATCH /me/preferences endpoint"
```

---

## Task 6: PreferencesProvider — sync preferences to backend

**Files:**
- Create: `frontend/src/providers/preferences-provider.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/hooks/use-auth.ts`

**Step 1: Update User interface in use-auth.ts**

In `frontend/src/hooks/use-auth.ts`, update the User interface (lines 6-11):

```ts
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  preferences?: {
    theme?: string;
    language?: string;
  };
}
```

**Step 2: Create PreferencesProvider**

Create `frontend/src/providers/preferences-provider.tsx`:

```tsx
'use client';
import { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';

interface PreferencesContextType {
  syncPreference: (key: 'theme' | 'language', value: string) => void;
}

const PreferencesContext = createContext<PreferencesContextType>({
  syncPreference: () => {},
});

export const usePreferences = () => useContext(PreferencesContext);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const { i18n } = useTranslation();
  const debounceRef = useRef<NodeJS.Timeout>();

  // On mount, check if user is logged in and apply their preferences
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    api.get('/api/auth/me').then((res) => {
      const prefs = res.data.preferences;
      if (prefs?.theme) setTheme(prefs.theme);
      if (prefs?.language) {
        i18n.changeLanguage(prefs.language);
        localStorage.setItem('mydevices-language', prefs.language);
      }
    }).catch(() => {});
  }, [setTheme, i18n]);

  const syncPreference = useCallback((key: 'theme' | 'language', value: string) => {
    // Immediate local effect
    if (key === 'theme') setTheme(value);
    if (key === 'language') {
      i18n.changeLanguage(value);
      localStorage.setItem('mydevices-language', value);
    }

    // Debounced backend sync
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const token = localStorage.getItem('token');
      if (token) {
        api.patch('/api/auth/me/preferences', { [key]: value }).catch(() => {});
      }
    }, 300);
  }, [setTheme, i18n]);

  return (
    <PreferencesContext.Provider value={{ syncPreference }}>
      {children}
    </PreferencesContext.Provider>
  );
}
```

**Step 3: Update layout.tsx to include PreferencesProvider**

Update `frontend/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { LanguageProvider } from "@/providers/language-provider";
import { PreferencesProvider } from "@/providers/preferences-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "myDevices - Apple 设备管理系统",
  description: "企业级 Apple 设备管理与 MDM 解决方案",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <LanguageProvider>
            <PreferencesProvider>
              {children}
            </PreferencesProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/src/providers/preferences-provider.tsx frontend/src/app/layout.tsx frontend/src/hooks/use-auth.ts
git commit -m "feat: add PreferencesProvider with backend sync"
```

---

## Task 7: Glassmorphism UI — Sidebar, Header, Card

**Files:**
- Modify: `frontend/src/components/layout/sidebar.tsx`
- Modify: `frontend/src/components/layout/header.tsx`
- Modify: `frontend/src/components/ui/card.tsx`
- Modify: `frontend/src/app/(dashboard)/layout.tsx`

**Step 1: Update Sidebar with glassmorphism + i18n**

Replace entire `frontend/src/components/layout/sidebar.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Smartphone, Package, Shield,
  ScrollText, BarChart3, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  { href: '/devices', labelKey: 'sidebar.devices', icon: Smartphone },
  { href: '/assets', labelKey: 'sidebar.assets', icon: Package },
  { href: '/profiles', labelKey: 'sidebar.profiles', icon: Shield },
  { href: '/audit-logs', labelKey: 'sidebar.auditLogs', icon: ScrollText },
  { href: '/reports', labelKey: 'sidebar.reports', icon: BarChart3 },
  { href: '/settings', labelKey: 'sidebar.settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  return (
    <aside className="w-64 border-r border-border bg-sidebar glass min-h-screen p-4">
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold">{t('app.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('app.subtitle')}</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
              pathname.startsWith(item.href)
                ? 'bg-primary/15 text-primary font-medium border-l-2 border-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

**Step 2: Update Header with theme/language toggles + i18n**

Replace entire `frontend/src/components/layout/header.tsx`:

```tsx
'use client';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from './language-toggle';

interface HeaderProps {
  onLogout: () => void;
  userName?: string;
}

export function Header({ onLogout, userName }: HeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="h-14 border-b border-border bg-card/50 glass-subtle flex items-center justify-between px-6 sticky top-0 z-10">
      <div />
      <div className="flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
        {userName && <span className="text-sm text-muted-foreground ml-2">{userName}</span>}
        <Button variant="ghost" size="sm" onClick={onLogout} className="rounded-full">
          <LogOut className="h-4 w-4 mr-2" />
          {t('common.logout')}
        </Button>
      </div>
    </header>
  );
}
```

**Step 3: Update Card component with glassmorphism**

In `frontend/src/components/ui/card.tsx`, update the Card function (line 9-11) className:

Replace:
```
"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
```
With:
```
"bg-card text-card-foreground flex flex-col gap-6 rounded-2xl border border-border py-6 shadow-sm glass-subtle",
```

**Step 4: Update dashboard layout with glassmorphism main area**

In `frontend/src/app/(dashboard)/layout.tsx`, update the loading text and add glass styling:

```tsx
'use client';
import { useAuth } from '@/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header onLogout={logout} userName={user.name} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add frontend/src/components/layout/ frontend/src/components/ui/card.tsx frontend/src/app/\(dashboard\)/layout.tsx
git commit -m "feat: glassmorphism UI for sidebar, header, card + i18n integration"
```

---

## Task 8: i18n — Login page

**Files:**
- Modify: `frontend/src/app/login/page.tsx`

**Step 1: Replace hardcoded strings with t()**

Replace the entire file with:

```tsx
'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const { t } = useTranslation();
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
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md glass">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('app.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('app.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50/50 dark:bg-red-950/30 dark:text-red-400 rounded-md">{error}</div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">{t('login.email')}</label>
              <Input id="email" type="email" placeholder="admin@mydevices.local" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">{t('login.password')}</label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

Key changes:
- Added `useTranslation()` hook
- All Chinese strings replaced with `t()` calls
- Removed `bg-gray-50` from container (now uses glassmorphism background)
- Added `glass` class to Card
- Error message uses dark mode compatible colors

**Step 2: Commit**

```bash
git add frontend/src/app/login/page.tsx
git commit -m "feat: i18n + glassmorphism for login page"
```

---

## Task 9: i18n — Dashboard page

**Files:**
- Modify: `frontend/src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Add i18n to dashboard page**

Add import at top:
```tsx
import { useTranslation } from 'react-i18next';
```

Add inside component function, first line:
```tsx
const { t } = useTranslation();
```

Replace all hardcoded Chinese strings:
- `'仪表盘'` → `t('dashboard.title')`
- `'设备总数'` → `t('dashboard.totalDevices')`
- `'已注册'` → `t('dashboard.enrolled')`
- `'待注册'` → `t('dashboard.pending')`
- `'设备类型分布'` → `t('dashboard.deviceTypeDistribution')`
- `'注册状态'` → `t('dashboard.enrollmentStatus')`
- `'最近设备'` → `t('dashboard.recentDevices')`
- `'设备名称'` → `t('dashboard.deviceName')`
- `'类型'` → `t('dashboard.type')`
- `'序列号'` → `t('dashboard.serial')`
- `'系统版本'` → `t('dashboard.osVersion')`
- `'状态'` → `t('dashboard.status')`
- `'暂无设备'` → `t('dashboard.noDevices')`
- Status labels object `{ pending: '待注册', enrolled: '已注册', unenrolled: '已注销' }` → `{ pending: t('status.pending'), enrolled: t('status.enrolled'), unenrolled: t('status.unenrolled') }`

Also replace `bg-gray-50` in table header with `bg-muted/30` for glassmorphism compatibility.
Replace `hover:bg-gray-50` in table rows with `hover:bg-muted/20`.

**Step 2: Commit**

```bash
git add frontend/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: i18n + glassmorphism for dashboard page"
```

---

## Task 10: i18n — Devices page

**Files:**
- Modify: `frontend/src/app/(dashboard)/devices/page.tsx`

**Step 1: Add i18n to devices page**

Add import at top:
```tsx
import { useTranslation } from 'react-i18next';
```

Add inside component, first line:
```tsx
const { t } = useTranslation();
```

Replace all hardcoded Chinese strings:
- `'设备管理'` → `t('devices.title')`
- `` `共 ${total} 台设备` `` → `t('devices.total', { count: total })`
- `'搜索设备名称、序列号...'` → `t('devices.searchPlaceholder')`
- `'全部类型'` → `t('common.allTypes')`
- `'设备名称'` (SortableHeader label) → `t('devices.name')`
- `'类型'` → `t('devices.type')`
- `'序列号'` → `t('devices.serial')`
- `'系统版本'` → `t('devices.osVersion')`
- `'注册状态'` → `t('devices.status')`
- `'最后在线'` → `t('devices.lastOnline')`
- `'操作'` → `t('common.actions')`
- `'详情'` → `t('common.details')`
- `'暂无设备'` → `t('devices.noDevices')`
- `` `共 ${total} 台 · 第 ${page}/...` `` → `t('devices.pageInfo', { total, page, pages: Math.max(1, Math.ceil(total / 20)) })`
- `'上一页'` → `t('common.prev')`
- `'下一页'` → `t('common.next')`

Replace `toLocaleString('zh-CN')` with a locale-aware approach:
```tsx
new Date(d.lastSeenAt).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US')
```
(Add `i18n` from `useTranslation()`: `const { t, i18n } = useTranslation();`)

Replace `bg-gray-50` → `bg-muted/30`, `hover:bg-gray-50` → `hover:bg-muted/20`.

**Step 2: Commit**

```bash
git add frontend/src/app/\(dashboard\)/devices/page.tsx
git commit -m "feat: i18n + glassmorphism for devices page"
```

---

## Task 11: i18n — Device detail page

**Files:**
- Modify: `frontend/src/app/(dashboard)/devices/[id]/page.tsx`

**Step 1: Add i18n**

Add import and hook as in previous tasks.

Replace all hardcoded Chinese strings:
- `'加载中...'` → `t('common.loading')`
- `'返回'` → `t('common.back')`
- `'编辑'` → `t('common.edit')`
- `'删除'` → `t('common.delete')`
- `'设备名称'` → `t('devices.name')`
- `'受监管'` → `t('devices.supervised')`
- `'取消'` → `t('common.cancel')`
- `'保存中...'` → `t('common.saving')`
- `'保存'` → `t('common.save')`
- `'确认删除'` → `t('common.confirmDelete')`
- Delete confirmation message → `t('devices.deleteConfirm', { name: device.deviceName || device.serialNumber })`
- Status label objects → use `t('status.pending')`, `t('status.enrolled')`, `t('status.unenrolled')`
- Command status labels → `t('commandStatus.queued')`, `t('commandStatus.sent')`, `t('commandStatus.acknowledged')`, `t('commandStatus.error')`, `t('commandStatus.notNow')`
- Asset status labels → `t('assetStatus.inUse')`, `t('assetStatus.inStock')`, etc.

Replace `bg-gray-*` classes with `bg-muted/*` equivalents.

**Step 2: Commit**

```bash
git add frontend/src/app/\(dashboard\)/devices/\[id\]/page.tsx
git commit -m "feat: i18n + glassmorphism for device detail page"
```

---

## Task 12: i18n — Assets page + detail + new

**Files:**
- Modify: `frontend/src/app/(dashboard)/assets/page.tsx`
- Modify: `frontend/src/app/(dashboard)/assets/[id]/page.tsx`
- Modify: `frontend/src/app/(dashboard)/assets/new/page.tsx`

**Step 1: Assets list page**

Add `useTranslation()` and replace:
- `'资产管理'` → `t('assets.title')`
- `'新建资产'` → `t('assets.newAsset')`
- `'搜索分配人、位置、序列号...'` → `t('assets.searchPlaceholder')`
- `'全部状态'` → `t('common.allStatus')`
- Table headers: `'设备'` → `t('assets.device')`, `'序列号'` → `t('assets.serial')`, `'分配人'` → `t('assets.assignedTo')`, `'部门'` → `t('assets.department')`, `'状态'` → `t('assets.status')`, `'保修截止'` → `t('assets.warrantyEnd')`, `'创建时间'` → `t('assets.createdAt')`, `'操作'` → `t('common.actions')`
- `'暂无资产'` → `t('assets.noAssets')`

Replace `bg-gray-*` with `bg-muted/*`.

**Step 2: Asset detail page**

Add `useTranslation()` and replace all Chinese strings with corresponding `t()` calls following the same pattern. Key strings:
- `'资产详情'` → `t('assets.detail')`
- `'资产信息'` → `t('assets.info')`
- Form labels and status labels use `t()` calls
- Delete confirmation → `t('assets.deleteConfirm')`

**Step 3: New asset page**

Add `useTranslation()` and replace:
- `'新建资产'` → `t('assets.newAsset')`
- `'创建失败，请检查输入'` → `t('assets.createFailed')`
- Form labels: `'设备 ID'` → `t('assets.deviceId')`, `'采购日期'` → `t('assets.purchaseDate')`, `'采购价格'` → `t('assets.purchasePrice')`, etc.
- `'创建中...'` → `t('common.creating')`, `'创建资产'` → `t('assets.createAsset')`

**Step 4: Commit**

```bash
git add frontend/src/app/\(dashboard\)/assets/
git commit -m "feat: i18n + glassmorphism for assets pages"
```

---

## Task 13: i18n — Profiles, Audit Logs, Reports pages

**Files:**
- Modify: `frontend/src/app/(dashboard)/profiles/page.tsx`
- Modify: `frontend/src/app/(dashboard)/audit-logs/page.tsx`
- Modify: `frontend/src/app/(dashboard)/reports/page.tsx`

**Step 1: Profiles page**

Add `useTranslation()` and replace:
- `'配置描述文件'` → `t('profiles.title')`
- `'新建'` → `t('common.new')`
- `'搜索名称、标识符...'` → `t('profiles.searchPlaceholder')`
- Table headers: `'名称'` → `t('profiles.name')`, `'标识符'` → `t('profiles.identifier')`, `'负载类型'` → `t('profiles.payloadType')`, `'设备数'` → `t('profiles.deviceCount')`, `'创建时间'` → `t('profiles.createdAt')`, `'操作'` → `t('common.actions')`
- `' 台'` → use `t('profiles.deviceUnit', { count })`
- `'暂无配置描述文件'` → `t('profiles.noProfiles')`
- Pagination strings → `t('common.prev')`, `t('common.next')`

Replace `bg-gray-*` with `bg-muted/*`.

**Step 2: Audit logs page**

Add `useTranslation()` and replace:
- `'审计日志'` → `t('audit.title')`
- `'按操作类型筛选...'` → `t('audit.filterByAction')`
- `'全部目标类型'` → `t('audit.allTargetTypes')`
- `'至'` → `t('common.to')`
- Table headers: `'时间'` → `t('audit.time')`, `'操作人'` → `t('audit.operator')`, `'操作'` → `t('audit.action')`, `'目标类型'` → `t('audit.targetType')`, `'目标 ID'` → `t('audit.targetId')`, `'IP 地址'` → `t('audit.ipAddress')`
- `'暂无日志'` → `t('audit.noLogs')`
- Pagination strings → same pattern

**Step 3: Reports page**

Add `useTranslation()` and replace:
- `'报表中心'` → `t('reports.title')`
- `'导出失败'` → `t('common.exportFailed')`
- `'MDM 注册率'` → `t('reports.mdmEnrollmentRate')`
- `'监管率'` → `t('reports.supervisionRate')`
- `'资产覆盖率'` → `t('reports.assetCoverageRate')`
- Tab labels: `'设备报表'` → `t('reports.deviceReport')`, `'资产报表'` → `t('reports.assetReport')`
- `'设备统计'` → `t('reports.deviceStats')`, `'资产统计'` → `t('reports.assetStats')`
- `'导出 CSV'` → `t('common.exportCsv')`
- Chart titles: `'设备类型分布'` → `t('reports.deviceTypeDistribution')`, `'资产状态分布'` → `t('reports.assetStatusDistribution')`, `'部门分布 (Top 10)'` → `t('reports.departmentDistribution')`
- `'未分配'` → `t('reports.unassigned')`
- Asset status labels → use `t('assetStatus.*')` calls

**Step 4: Commit**

```bash
git add frontend/src/app/\(dashboard\)/profiles/ frontend/src/app/\(dashboard\)/audit-logs/ frontend/src/app/\(dashboard\)/reports/
git commit -m "feat: i18n + glassmorphism for profiles, audit-logs, reports pages"
```

---

## Task 14: i18n — Settings page + constants.ts

**Files:**
- Modify: `frontend/src/app/(dashboard)/settings/page.tsx`
- Modify: `frontend/src/lib/constants.ts`

**Step 1: Settings page**

Add `useTranslation()` and replace all Chinese strings:
- `'系统设置'` → `t('settings.title')`
- `'用户创建成功'` → `t('settings.userCreated')`
- `'创建失败'` → `t('settings.createFailed')`
- `'编辑失败'` → `t('settings.editFailed')`
- Role labels: `'超级管理员'` → `t('roles.superAdmin')`, `'设备管理员'` → `t('roles.deviceAdmin')`, `'只读用户'` → `t('roles.readonly')`
- Dialog strings: `'取消'` → `t('common.cancel')`, `'保存'` → `t('common.save')`
- `'确认删除'` → `t('common.confirmDelete')`
- Delete confirmation → `t('settings.deleteUserConfirm', { name: deleteTarget?.name })`

**Step 2: Update constants.ts**

The label maps in `constants.ts` (ENROLLMENT_STATUS_LABELS, ASSET_STATUS_LABELS, ROLE_LABELS) contain hardcoded Chinese. Since these are used in components that now have `t()`, we have two options:

Option A (recommended): Remove the label constants and use `t()` directly in components.
Option B: Keep them but make them functions that accept `t`.

Go with Option A. Remove `ENROLLMENT_STATUS_LABELS`, `ASSET_STATUS_LABELS`, `ROLE_LABELS` from constants.ts. Keep `DEVICE_ICONS`, `ASSET_STATUS_VARIANT`, `DEVICE_TYPES` (these are not language-dependent).

Updated `frontend/src/lib/constants.ts`:

```ts
import type React from 'react';
import { Smartphone, Tablet, Monitor, Tv, Watch, Glasses } from 'lucide-react';

export const DEVICE_ICONS: Record<string, React.ElementType> = {
  iPhone: Smartphone,
  iPad: Tablet,
  Mac: Monitor,
  AppleTV: Tv,
  AppleWatch: Watch,
  VisionPro: Glasses,
};

export const ASSET_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  in_use: 'default',
  in_stock: 'secondary',
  repairing: 'outline',
  retired: 'secondary',
  lost: 'destructive',
};

export const DEVICE_TYPES = ['iPhone', 'iPad', 'Mac', 'AppleTV', 'AppleWatch', 'VisionPro'];
```

Update any component that imported the removed constants to use `t()` instead.

**Step 3: Commit**

```bash
git add frontend/src/app/\(dashboard\)/settings/page.tsx frontend/src/lib/constants.ts
git commit -m "feat: i18n for settings page, remove hardcoded label constants"
```

---

## Task 15: Update html lang attribute dynamically

**Files:**
- Modify: `frontend/src/providers/language-provider.tsx`

**Step 1: Add lang attribute sync**

In the `LanguageProvider`, add an effect that updates `document.documentElement.lang` when language changes:

```tsx
useEffect(() => {
  document.documentElement.lang = i18n.language === 'zh' ? 'zh-CN' : 'en';
}, [i18n.language]);
```

Add this inside the `LanguageProvider` component, after the existing `useEffect`.

Also update the `handleLanguageChanged` callback to sync the lang attribute:

```tsx
const handleLanguageChanged = (lng: string) => {
  localStorage.setItem('mydevices-language', lng);
  document.documentElement.lang = lng === 'zh' ? 'zh-CN' : 'en';
};
```

**Step 2: Commit**

```bash
git add frontend/src/providers/language-provider.tsx
git commit -m "feat: sync html lang attribute with i18n language"
```

---

## Task 16: Visual polish — transitions and hover effects

**Files:**
- Modify: `frontend/src/app/globals.css`

**Step 1: Add smooth theme transition**

Add to `globals.css` after the glass utilities:

```css
/* Smooth theme transitions */
html.transitioning,
html.transitioning *,
html.transitioning *::before,
html.transitioning *::after {
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.2s ease !important;
}
```

**Step 2: Add selection color**

Add to `@layer base`:

```css
::selection {
  background: oklch(0.55 0.2 265 / 30%);
}
.dark ::selection {
  background: oklch(0.7 0.18 265 / 30%);
}
```

**Step 3: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "style: add theme transitions and selection color"
```

---

## Task 17: Smoke test and final verification

**Step 1: Build check**

Run:
```bash
cd frontend && npm run build
```
Expected: Build succeeds with no errors.

**Step 2: Verify all pages render**

Run dev server manually and check:
- [ ] Login page renders with glassmorphism card
- [ ] Theme toggle cycles: light → dark → system
- [ ] Language toggle switches between 中文 and English
- [ ] Sidebar has glass effect with translucent background
- [ ] Header has glass-subtle effect
- [ ] Cards have translucent backgrounds
- [ ] Dark mode: background gradient shifts to darker tones
- [ ] All pages show translated strings (no raw Chinese in English mode)
- [ ] Preferences persist after page refresh (localStorage)
- [ ] After login, preferences sync from backend

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete theme/i18n/glassmorphism implementation"
```

---

## Summary of all commits

1. `chore: add next-themes, i18next, react-i18next`
2. `style: iOS 26 glassmorphism CSS variables and utilities`
3. `feat: add ThemeProvider and ThemeToggle component`
4. `feat: add i18n with i18next, LanguageProvider, and LanguageToggle`
5. `feat: add user preferences field and PATCH /me/preferences endpoint`
6. `feat: add PreferencesProvider for backend preference sync`
7. `feat: glassmorphism UI for sidebar, header, card + i18n integration`
8. `feat: i18n + glassmorphism for login page`
9. `feat: i18n + glassmorphism for dashboard page`
10. `feat: i18n + glassmorphism for devices page`
11. `feat: i18n + glassmorphism for device detail page`
12. `feat: i18n + glassmorphism for assets pages`
13. `feat: i18n + glassmorphism for profiles, audit-logs, reports pages`
14. `feat: i18n for settings page, remove hardcoded label constants`
15. `feat: sync html lang attribute with i18n language`
16. `style: add theme transitions and selection color`
17. `feat: complete theme/i18n/glassmorphism implementation`
