import { PrismaClient, DeviceType, EnrollmentStatus } from '@prisma/client';

interface DeviceFilters {
  deviceType?: DeviceType;
  enrollmentStatus?: EnrollmentStatus;
  search?: string;
}

export class DeviceService {
  constructor(private prisma: PrismaClient) {}

  async list(page = 1, limit = 20, filters?: DeviceFilters, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const where: any = {};
    if (filters?.deviceType) where.deviceType = filters.deviceType;
    if (filters?.enrollmentStatus) where.enrollmentStatus = filters.enrollmentStatus;
    if (filters?.search) {
      where.OR = [
        { deviceName: { contains: filters.search, mode: 'insensitive' } },
        { serialNumber: { contains: filters.search, mode: 'insensitive' } },
        { modelName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const allowedSort = ['createdAt', 'deviceName', 'serialNumber', 'deviceType', 'osVersion', 'lastSeenAt', 'enrollmentStatus'];
    const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        include: { asset: { select: { status: true, assignedToId: true, department: true } } },
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.device.count({ where }),
    ]);
    return { devices, total, page, limit };
  }

  async getById(id: string) {
    return this.prisma.device.findUniqueOrThrow({
      where: { id },
      include: {
        asset: true,
        commands: { orderBy: { queuedAt: 'desc' }, take: 20 },
        profiles: { include: { profile: true } },
      },
    });
  }

  async update(id: string, data: Partial<{ deviceName: string; supervised: boolean }>) {
    return this.prisma.device.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.device.delete({ where: { id } });
  }

  async getCommandHistory(deviceId: string, page = 1, limit = 20) {
    const [commands, total] = await Promise.all([
      this.prisma.mDMCommand.findMany({
        where: { deviceId },
        orderBy: { queuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.mDMCommand.count({ where: { deviceId } }),
    ]);
    return { commands, total, page, limit };
  }
}
