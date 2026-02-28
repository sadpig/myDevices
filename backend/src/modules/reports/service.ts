import { PrismaClient } from '@prisma/client';

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  async deviceStats() {
    const [byType, byStatus, byOS, total] = await Promise.all([
      this.prisma.device.groupBy({ by: ['deviceType'], _count: true }),
      this.prisma.device.groupBy({ by: ['enrollmentStatus'], _count: true }),
      this.prisma.device.groupBy({ by: ['osVersion'], _count: true, orderBy: { _count: { osVersion: 'desc' } }, take: 10 }),
      this.prisma.device.count(),
    ]);
    return { byType, byStatus, byOS, total };
  }

  async assetStats() {
    const [byStatus, byDepartment, total] = await Promise.all([
      this.prisma.asset.groupBy({ by: ['status'], _count: true }),
      this.prisma.asset.groupBy({ by: ['department'], _count: true, orderBy: { _count: { department: 'desc' } }, take: 10 }),
      this.prisma.asset.count(),
    ]);
    return { byStatus, byDepartment, total };
  }

  async compliance() {
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
  }
}
