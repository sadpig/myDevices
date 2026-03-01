import { PrismaClient, AssetStatus } from '@prisma/client';
import { NotificationService } from '../../services/notification.js';

interface AssetFilters {
  status?: AssetStatus;
  departmentId?: string;
  search?: string;
}

export class AssetService {
  constructor(private prisma: PrismaClient) {}

  async list(page = 1, limit = 20, filters?: AssetFilters, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.search) {
      where.OR = [
        { assignedUser: { name: { contains: filters.search, mode: 'insensitive' } } },
        { location: { contains: filters.search, mode: 'insensitive' } },
        { device: { serialNumber: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const allowedSort = ['createdAt', 'status', 'departmentId', 'assignedToId', 'purchaseDate', 'warrantyEnd', 'purchasePrice'];
    const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: {
          device: { select: { serialNumber: true, deviceName: true, deviceType: true, modelName: true } },
          department: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.asset.count({ where }),
    ]);
    return { assets, total, page, limit };
  }

  async getById(id: string) {
    return this.prisma.asset.findUniqueOrThrow({
      where: { id },
      include: {
        device: true,
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async create(data: { deviceId: string; purchaseDate?: string; purchasePrice?: number; warrantyEnd?: string; assignedToId?: string; departmentId?: string; location?: string; status?: AssetStatus; notes?: string }) {
    const asset = await this.prisma.asset.create({
      data: {
        deviceId: data.deviceId,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        purchasePrice: data.purchasePrice,
        warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : undefined,
        assignedToId: data.assignedToId,
        departmentId: data.departmentId,
        location: data.location,
        status: data.status || 'in_stock',
        notes: data.notes,
      },
      include: {
        device: true,
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (data.assignedToId) {
      const notifService = new NotificationService(this.prisma);
      const device = asset.device;
      await notifService.createAndEmail(
        data.assignedToId,
        '资产分配通知',
        `您已被分配设备: ${device?.deviceName || device?.serialNumber || data.deviceId}`,
        'asset_assigned'
      );
    }

    return asset;
  }

  async update(id: string, data: Partial<{ purchaseDate: string; purchasePrice: number; warrantyEnd: string; assignedToId: string; departmentId: string; location: string; status: AssetStatus; notes: string }>) {
    const updateData: any = { ...data };
    if (data.purchaseDate) updateData.purchaseDate = new Date(data.purchaseDate);
    if (data.warrantyEnd) updateData.warrantyEnd = new Date(data.warrantyEnd);
    const asset = await this.prisma.asset.update({
      where: { id },
      data: updateData,
      include: {
        device: true,
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (data.assignedToId) {
      const notifService = new NotificationService(this.prisma);
      const device = asset.device;
      await notifService.createAndEmail(
        data.assignedToId,
        '资产分配通知',
        `您已被分配设备: ${device?.deviceName || device?.serialNumber || id}`,
        'asset_assigned'
      );
    }

    return asset;
  }

  async stats() {
    const [byStatus, byDepartment, total] = await Promise.all([
      this.prisma.asset.groupBy({ by: ['status'], _count: true }),
      this.prisma.asset.groupBy({ by: ['departmentId'], _count: true, orderBy: { _count: { departmentId: 'desc' } }, take: 10 }),
      this.prisma.asset.count(),
    ]);
    return { byStatus, byDepartment, total };
  }

  async remove(id: string) {
    return this.prisma.asset.delete({ where: { id } });
  }
}
