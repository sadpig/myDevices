import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export class ReportService {
  constructor(
    private prisma: PrismaClient,
    private redis?: Redis,
  ) {}

  private async cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    if (this.redis) {
      const hit = await this.redis.get(key);
      if (hit) return JSON.parse(hit);
    }
    const result = await fn();
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(result), 'EX', ttl);
    }
    return result;
  }

  async deviceStats() {
    return this.cached('report:devices', 60, async () => {
      const [byType, byStatus, byOS, total] = await Promise.all([
        this.prisma.device.groupBy({ by: ['deviceType'], _count: true }),
        this.prisma.device.groupBy({ by: ['enrollmentStatus'], _count: true }),
        this.prisma.device.groupBy({ by: ['osVersion'], _count: true, orderBy: { _count: { osVersion: 'desc' } }, take: 10 }),
        this.prisma.device.count(),
      ]);
      return { byType, byStatus, byOS, total };
    });
  }

  async assetStats() {
    return this.cached('report:assets', 60, async () => {
      const [byStatus, byDepartment, total] = await Promise.all([
        this.prisma.asset.groupBy({ by: ['status'], _count: true }),
        this.prisma.asset.groupBy({ by: ['department'], _count: true, orderBy: { _count: { department: 'desc' } }, take: 10 }),
        this.prisma.asset.count(),
      ]);
      return { byStatus, byDepartment, total };
    });
  }

  async compliance() {
    return this.cached('report:compliance', 60, async () => {
      const [totalDevices, enrolled, supervised, withAsset] = await Promise.all([
        this.prisma.device.count(),
        this.prisma.device.count({ where: { enrollmentStatus: 'enrolled' } }),
        this.prisma.device.count({ where: { supervised: true } }),
        this.prisma.asset.count(),
      ]);
      return {
        totalDevices,
        enrolled,
        enrollmentRate: totalDevices > 0 ? (enrolled / totalDevices * 100).toFixed(1) : '0',
        supervised,
        supervisionRate: totalDevices > 0 ? (supervised / totalDevices * 100).toFixed(1) : '0',
        withAsset,
        assetCoverage: totalDevices > 0 ? (withAsset / totalDevices * 100).toFixed(1) : '0',
      };
    });
  }

  deviceStatsToCsv(data: any): string {
    let csv = '设备统计报表\n\n';
    csv += '设备类型,数量\n';
    data.byType.forEach((r: any) => { csv += `${r.deviceType},${r._count}\n`; });
    csv += '\n注册状态,数量\n';
    data.byStatus.forEach((r: any) => { csv += `${r.enrollmentStatus},${r._count}\n`; });
    csv += `\n总计,${data.total}\n`;
    return csv;
  }

  assetStatsToCsv(data: any): string {
    let csv = '资产统计报表\n\n';
    csv += '资产状态,数量\n';
    data.byStatus.forEach((r: any) => { csv += `${r.status},${r._count}\n`; });
    csv += '\n部门,数量\n';
    data.byDepartment.forEach((r: any) => { csv += `${r.department || "未分配"},${r._count}\n`; });
    csv += `\n总计,${data.total}\n`;
    return csv;
  }
}
