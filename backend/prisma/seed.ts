import 'dotenv/config';
import { PrismaClient, DeviceType, EnrollmentStatus, AssetStatus, CommandStatus, DataScope } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashSync } from 'bcryptjs';
import { randomUUID } from 'crypto';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || 'postgresql://mydevices:mydevices_dev@localhost:5432/mydevices',
});
const prisma = new PrismaClient({ adapter });

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

const LOCATIONS = ['北京总部 3F', '北京总部 5F', '上海办公室', '深圳办公室', '杭州办公室', '成都办公室'];
const NAMES = ['张伟', '李娜', '王磊', '刘洋', '陈静', '杨帆', '赵敏', '黄海', '周琳', '吴强', '孙悦', '马超', '朱丽', '胡明', '林峰'];

const DEVICES_DATA: { type: DeviceType; models: { model: string; modelName: string; productName: string }[] }[] = [
  {
    type: 'iPhone',
    models: [
      { model: 'iPhone16,2', modelName: 'iPhone 15 Pro Max', productName: 'iPhone' },
      { model: 'iPhone15,3', modelName: 'iPhone 14 Pro Max', productName: 'iPhone' },
      { model: 'iPhone14,5', modelName: 'iPhone 13', productName: 'iPhone' },
      { model: 'iPhone17,1', modelName: 'iPhone 16 Pro', productName: 'iPhone' },
    ],
  },
  {
    type: 'iPad',
    models: [
      { model: 'iPad14,6', modelName: 'iPad Pro 12.9" (6th gen)', productName: 'iPad' },
      { model: 'iPad13,18', modelName: 'iPad Air (5th gen)', productName: 'iPad' },
      { model: 'iPad14,1', modelName: 'iPad mini (6th gen)', productName: 'iPad' },
    ],
  },
  {
    type: 'Mac',
    models: [
      { model: 'Mac14,2', modelName: 'MacBook Air M2', productName: 'Mac' },
      { model: 'Mac15,3', modelName: 'MacBook Pro 14" M3 Pro', productName: 'Mac' },
      { model: 'Mac14,13', modelName: 'Mac Studio M2 Ultra', productName: 'Mac' },
      { model: 'Mac15,10', modelName: 'MacBook Pro 16" M3 Max', productName: 'Mac' },
    ],
  },
  {
    type: 'AppleWatch',
    models: [
      { model: 'Watch7,3', modelName: 'Apple Watch Ultra 2', productName: 'AppleWatch' },
      { model: 'Watch7,1', modelName: 'Apple Watch Series 9', productName: 'AppleWatch' },
    ],
  },
  {
    type: 'AppleTV',
    models: [
      { model: 'AppleTV14,1', modelName: 'Apple TV 4K (3rd gen)', productName: 'AppleTV' },
    ],
  },
];

const OS_VERSIONS: Record<string, string[]> = {
  iPhone: ['17.4.1', '17.5', '18.0', '18.1'],
  iPad: ['17.4.1', '17.5', '18.0'],
  Mac: ['14.4.1', '14.5', '15.0', '15.1'],
  AppleWatch: ['10.4', '10.5', '11.0'],
  AppleTV: ['17.4', '17.5', '18.0'],
};

function generateSerial(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function generateMAC(): string {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':');
}

// ─── RBAC seed data ───────────────────────────────────────────────────────────

const PERMISSIONS = [
  { code: 'device:read', name: '查看设备', module: 'device', sortOrder: 1 },
  { code: 'device:write', name: '编辑设备', module: 'device', sortOrder: 2 },
  { code: 'device:delete', name: '删除设备', module: 'device', sortOrder: 3 },
  { code: 'asset:read', name: '查看资产', module: 'asset', sortOrder: 4 },
  { code: 'asset:write', name: '编辑资产', module: 'asset', sortOrder: 5 },
  { code: 'asset:delete', name: '删除资产', module: 'asset', sortOrder: 6 },
  { code: 'profile:read', name: '查看配置文件', module: 'profile', sortOrder: 7 },
  { code: 'profile:write', name: '编辑配置文件', module: 'profile', sortOrder: 8 },
  { code: 'profile:delete', name: '删除配置文件', module: 'profile', sortOrder: 9 },
  { code: 'user:read', name: '查看人员', module: 'user', sortOrder: 10 },
  { code: 'user:write', name: '编辑人员', module: 'user', sortOrder: 11 },
  { code: 'user:delete', name: '删除人员', module: 'user', sortOrder: 12 },
  { code: 'dept:read', name: '查看部门', module: 'department', sortOrder: 13 },
  { code: 'dept:write', name: '编辑部门', module: 'department', sortOrder: 14 },
  { code: 'dept:delete', name: '删除部门', module: 'department', sortOrder: 15 },
  { code: 'role:read', name: '查看角色', module: 'role', sortOrder: 16 },
  { code: 'role:write', name: '编辑角色', module: 'role', sortOrder: 17 },
  { code: 'role:delete', name: '删除角色', module: 'role', sortOrder: 18 },
  { code: 'audit:read', name: '查看审计日志', module: 'audit', sortOrder: 19 },
  { code: 'report:read', name: '查看报表', module: 'report', sortOrder: 20 },
  { code: 'settings:read', name: '查看设置', module: 'settings', sortOrder: 21 },
  { code: 'settings:write', name: '编辑设置', module: 'settings', sortOrder: 22 },
];

const ROLES = [
  {
    code: 'super_admin', name: '超级管理员', description: '系统最高权限',
    dataScope: 'all' as DataScope, isSystem: true, allowedProfileTypes: [] as string[],
    permissionCodes: PERMISSIONS.map(p => p.code),
  },
  {
    code: 'device_admin', name: '设备管理员', description: '管理设备和资产',
    dataScope: 'department_and_children' as DataScope, isSystem: true, allowedProfileTypes: [] as string[],
    permissionCodes: [
      'device:read', 'device:write',
      'asset:read', 'asset:write',
      'profile:read', 'profile:write',
      'audit:read', 'report:read',
    ],
  },
  {
    code: 'readonly', name: '只读用户', description: '只能查看数据',
    dataScope: 'self' as DataScope, isSystem: true, allowedProfileTypes: [] as string[],
    permissionCodes: [
      'device:read', 'asset:read', 'profile:read',
      'user:read', 'dept:read', 'role:read',
      'audit:read', 'report:read', 'settings:read',
    ],
  },
];

const DEPT_DATA = [
  { code: 'hq', name: '总部', parentCode: null as string | null, sortOrder: 1 },
  { code: 'tech', name: '技术部', parentCode: 'hq', sortOrder: 1 },
  { code: 'market', name: '市场部', parentCode: 'hq', sortOrder: 2 },
  { code: 'finance', name: '财务部', parentCode: 'hq', sortOrder: 3 },
  { code: 'frontend', name: '前端组', parentCode: 'tech', sortOrder: 1 },
  { code: 'backend', name: '后端组', parentCode: 'tech', sortOrder: 2 },
];

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Permissions
  console.log('Seeding permissions...');
  const permissionMap: Record<string, string> = {};
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, module: p.module, sortOrder: p.sortOrder },
      create: p,
    });
    permissionMap[p.code] = perm.id;
  }

  // 2. Roles + RolePermissions
  console.log('Seeding roles...');
  const roleMap: Record<string, string> = {};
  for (const r of ROLES) {
    const { permissionCodes, ...roleData } = r;
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description, dataScope: r.dataScope },
      create: roleData,
    });
    roleMap[r.code] = role.id;
    // Clear existing permissions and re-create
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissionCodes.map(code => ({ roleId: role.id, permissionId: permissionMap[code] })),
    });
  }

  // 3. Departments
  console.log('Seeding departments...');
  const deptMap: Record<string, string> = {};
  for (const d of DEPT_DATA) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, sortOrder: d.sortOrder, parentId: d.parentCode ? deptMap[d.parentCode] : null },
      create: { code: d.code, name: d.name, sortOrder: d.sortOrder, parentId: d.parentCode ? deptMap[d.parentCode] : null },
    });
    deptMap[d.code] = dept.id;
  }

  // 4. Users
  console.log('Seeding users...');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mydevices.local' },
    update: {},
    create: {
      email: 'admin@mydevices.local',
      name: '系统管理员',
      passwordHash: hashSync('admin123', 12),
      roleId: roleMap['super_admin'],
      departmentId: deptMap['hq'],
    },
  });

  const deviceAdmin = await prisma.user.upsert({
    where: { email: 'deviceadmin@mydevices.local' },
    update: {},
    create: {
      email: 'deviceadmin@mydevices.local',
      name: '设备管理员',
      passwordHash: hashSync('admin123', 12),
      roleId: roleMap['device_admin'],
      departmentId: deptMap['tech'],
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@mydevices.local' },
    update: {},
    create: {
      email: 'viewer@mydevices.local',
      name: '只读用户',
      passwordHash: hashSync('admin123', 12),
      roleId: roleMap['readonly'],
      departmentId: deptMap['frontend'],
    },
  });

  // 5. Devices
  console.log('Seeding devices...');

  const deviceIds: string[] = [];
  const enrollmentStatuses: EnrollmentStatus[] = ['enrolled', 'enrolled', 'enrolled', 'pending', 'unenrolled'];

  for (let i = 0; i < 30; i++) {
    const deviceGroup = randomItem(DEVICES_DATA);
    const modelInfo = randomItem(deviceGroup.models);
    const enrollStatus = randomItem(enrollmentStatuses);
    const isEnrolled = enrollStatus === 'enrolled';

    const device = await prisma.device.create({
      data: {
        udid: randomUUID(),
        serialNumber: generateSerial(),
        deviceType: deviceGroup.type,
        model: modelInfo.model,
        modelName: modelInfo.modelName,
        osVersion: randomItem(OS_VERSIONS[deviceGroup.type] || ['17.0']),
        buildVersion: `21${String.fromCharCode(65 + Math.floor(Math.random() * 6))}${Math.floor(Math.random() * 999)}`,
        deviceName: `${randomItem(NAMES)}的${modelInfo.modelName}`,
        productName: modelInfo.productName,
        storageCapacity: BigInt(randomItem([64, 128, 256, 512, 1024]) * 1_000_000_000),
        wifiMac: generateMAC(),
        bluetoothMac: generateMAC(),
        enrollmentStatus: enrollStatus,
        mdmEnrolled: isEnrolled,
        supervised: isEnrolled && Math.random() > 0.3,
        pushMagic: isEnrolled ? randomUUID() : null,
        pushToken: isEnrolled ? randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '') : null,
        lastSeenAt: isEnrolled ? randomDate(new Date('2025-12-01'), new Date()) : null,
      },
    });
    deviceIds.push(device.id);
  }

  console.log(`Created ${deviceIds.length} devices`);

  // 6. Assets (departmentId instead of department string)
  console.log('Seeding assets...');

  const userIds = [admin.id, deviceAdmin.id, viewer.id];

  const assetStatuses: AssetStatus[] = ['in_use', 'in_use', 'in_use', 'in_stock', 'repairing', 'retired', 'lost'];
  const assetsToCreate = deviceIds.slice(0, 22);
  const allDeptIds = Object.values(deptMap);

  for (const deviceId of assetsToCreate) {
    const status = randomItem(assetStatuses);
    await prisma.asset.create({
      data: {
        deviceId,
        purchaseDate: randomDate(new Date('2023-01-01'), new Date('2025-06-01')),
        purchasePrice: parseFloat((Math.random() * 30000 + 2000).toFixed(2)),
        warrantyEnd: randomDate(new Date('2025-06-01'), new Date('2027-12-31')),
        assignedToId: status === 'in_use' ? randomItem(userIds) : null,
        departmentId: randomItem(allDeptIds),
        location: randomItem(LOCATIONS),
        status,
        notes: Math.random() > 0.6 ? randomItem(['公司统一采购', '项目专用设备', '备用机', '测试设备', '高管配备']) : null,
      },
    });
  }

  console.log(`Created ${assetsToCreate.length} assets`);

  // 7. Profiles
  console.log('Seeding profiles...');

  const profiles = [
    { name: 'WiFi 配置', identifier: 'com.mydevices.wifi', payloadType: 'com.apple.wifi.managed', payload: { SSID_STR: 'CorpWiFi', EncryptionType: 'WPA2' } },
    { name: 'VPN 配置', identifier: 'com.mydevices.vpn', payloadType: 'com.apple.vpn.managed', payload: { VPNType: 'IKEv2', RemoteAddress: 'vpn.example.com' } },
    { name: '邮件配置', identifier: 'com.mydevices.mail', payloadType: 'com.apple.mail.managed', payload: { IncomingMailServerHostName: 'mail.example.com', OutgoingMailServerHostName: 'smtp.example.com' } },
    { name: '密码策略', identifier: 'com.mydevices.passcode', payloadType: 'com.apple.mobiledevice.passwordpolicy', payload: { minLength: 6, requireAlphanumeric: true } },
    { name: '限制策略', identifier: 'com.mydevices.restrictions', payloadType: 'com.apple.applicationaccess', payload: { allowCamera: true, allowScreenShot: false } },
  ];

  const profileIds: string[] = [];
  for (const p of profiles) {
    const profile = await prisma.profile.upsert({
      where: { identifier: p.identifier },
      update: {},
      create: { name: p.name, identifier: p.identifier, payloadType: p.payloadType, payload: p.payload, description: `${p.name} - 自动生成的测试描述文件` },
    });
    profileIds.push(profile.id);
  }

  // Assign profiles to enrolled devices
  const enrolledDevices = await prisma.device.findMany({ where: { enrollmentStatus: 'enrolled' }, select: { id: true } });
  for (const device of enrolledDevices) {
    const profilesToAssign = profileIds.filter(() => Math.random() > 0.4);
    for (const profileId of profilesToAssign) {
      await prisma.deviceProfile.upsert({
        where: { deviceId_profileId: { deviceId: device.id, profileId } },
        update: {},
        create: { deviceId: device.id, profileId, installedAt: randomDate(new Date('2025-06-01'), new Date()) },
      });
    }
  }

  console.log(`Created ${profiles.length} profiles`);

  // 8. MDM Commands
  console.log('Seeding MDM commands...');

  const commandTypes = ['DeviceInformation', 'InstalledApplicationList', 'DeviceLock', 'ClearPasscode', 'RestartDevice', 'ProfileList'];
  const commandStatuses: CommandStatus[] = ['acknowledged', 'acknowledged', 'acknowledged', 'queued', 'sent', 'error', 'not_now'];

  for (const device of enrolledDevices.slice(0, 15)) {
    const numCommands = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < numCommands; i++) {
      const status = randomItem(commandStatuses);
      const queuedAt = randomDate(new Date('2025-10-01'), new Date());
      await prisma.mDMCommand.create({
        data: {
          deviceId: device.id,
          commandType: randomItem(commandTypes),
          payload: {},
          status,
          requestId: randomUUID(),
          queuedAt,
          sentAt: status !== 'queued' ? new Date(queuedAt.getTime() + Math.random() * 60000) : null,
          acknowledgedAt: status === 'acknowledged' ? new Date(queuedAt.getTime() + Math.random() * 120000) : null,
          result: status === 'acknowledged' ? { Status: 'Acknowledged' } : status === 'error' ? { Status: 'Error', ErrorChain: [{ ErrorCode: 12021 }] } : null,
        },
      });
    }
  }

  // 9. Audit Logs
  console.log('Seeding audit logs...');

  const actions = ['asset.create', 'asset.update', 'asset.delete', 'device.enroll', 'device.command', 'user.login', 'user.create'];
  const targetTypes = ['asset', 'device', 'user'];

  for (let i = 0; i < 50; i++) {
    const action = randomItem(actions);
    await prisma.auditLog.create({
      data: {
        userId: randomItem(userIds),
        action,
        targetType: randomItem(targetTypes),
        targetId: randomUUID(),
        details: { action, source: 'seed' },
        ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
        createdAt: randomDate(new Date('2025-09-01'), new Date()),
      },
    });
  }

  console.log('Seed completed!');
  console.log('---');
  console.log('Users: admin@mydevices.local / deviceadmin@mydevices.local / viewer@mydevices.local');
  console.log('Password for all: admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
