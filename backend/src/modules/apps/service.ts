import { PrismaClient } from '@prisma/client';

export class AppService {
  constructor(private prisma: PrismaClient) {}

  async list(page = 1, limit = 20, filters?: { search?: string; category?: string }) {
    const where: any = {};
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { bundleId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.category) where.category = filters.category;
    const [apps, total] = await Promise.all([
      this.prisma.app.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { assignments: true } } },
      }),
      this.prisma.app.count({ where }),
    ]);
    return { apps, total, page, limit };
  }

  async getById(id: string) {
    return this.prisma.app.findUniqueOrThrow({
      where: { id },
      include: {
        assignments: {
          include: {
            device: { select: { id: true, deviceName: true, serialNumber: true } },
            department: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async create(data: { bundleId: string; name: string; version?: string; category?: string; managedApp?: boolean; source?: string }) {
    return this.prisma.app.create({ data });
  }

  async update(id: string, data: Partial<{ name: string; version: string; category: string; managedApp: boolean; source: string }>) {
    return this.prisma.app.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.app.delete({ where: { id } });
  }

  async install(appId: string, targets: { deviceIds?: string[]; departmentId?: string }) {
    const assignments = [];
    if (targets.deviceIds) {
      for (const deviceId of targets.deviceIds) {
        assignments.push(
          this.prisma.appAssignment.create({
            data: { appId, deviceId, status: 'pending' },
          })
        );
      }
    }
    if (targets.departmentId) {
      assignments.push(
        this.prisma.appAssignment.create({
          data: { appId, departmentId: targets.departmentId, status: 'pending' },
        })
      );
    }
    return Promise.all(assignments);
  }

  async uninstall(appId: string, deviceIds: string[]) {
    return this.prisma.appAssignment.updateMany({
      where: { appId, deviceId: { in: deviceIds } },
      data: { status: 'removed' },
    });
  }
}
