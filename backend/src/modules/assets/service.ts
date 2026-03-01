import { PrismaClient, AssetStatus } from '@prisma/client';
import { NotificationService } from '../../services/notification.js';
import { emailTemplates } from '../../services/email-templates.js';
import { AssetHistoryService } from './history-service.js';

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
      const tmpl = emailTemplates.assetAssigned({
        userName: asset.assignedUser?.name || '',
        deviceName: device?.deviceName || device?.serialNumber || '',
        serialNumber: device?.serialNumber || '',
      });
      await notifService.createAndEmail(data.assignedToId, tmpl.subject, tmpl.html, 'asset_assigned');
    }

    // Record history
    const historyService = new AssetHistoryService(this.prisma);
    await historyService.record(asset.id, 'created', {
      toUserId: data.assignedToId || null,
      toStatus: data.status || 'in_stock',
    });

    return asset;
  }

  async update(id: string, data: Partial<{ purchaseDate: string; purchasePrice: number; warrantyEnd: string; assignedToId: string; departmentId: string; location: string; status: AssetStatus; notes: string }>) {
    const oldAsset = await this.prisma.asset.findUnique({
      where: { id }, select: { assignedToId: true, status: true },
    });

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

    const notifService = new NotificationService(this.prisma);
    const device = asset.device;

    // Notify on assignment change
    if (data.assignedToId && data.assignedToId !== oldAsset?.assignedToId) {
      const tmpl = emailTemplates.assetAssigned({
        userName: asset.assignedUser?.name || '',
        deviceName: device?.deviceName || device?.serialNumber || '',
        serialNumber: device?.serialNumber || '',
      });
      await notifService.createAndEmail(data.assignedToId, tmpl.subject, tmpl.html, 'asset_assigned');
    }

    // Notify on status change to lost/retired
    if (data.status && ['lost', 'retired'].includes(data.status) && oldAsset?.assignedToId) {
      const tmpl = emailTemplates.assetStatusChanged({
        userName: asset.assignedUser?.name || '',
        deviceName: device?.deviceName || device?.serialNumber || '',
        oldStatus: oldAsset.status || '',
        newStatus: data.status,
      });
      await notifService.createAndEmail(oldAsset.assignedToId, tmpl.subject, tmpl.html, 'asset_status_changed');
    }

    // Record history for assignment/status changes
    const historyService = new AssetHistoryService(this.prisma);
    if (data.assignedToId && data.assignedToId !== oldAsset?.assignedToId) {
      await historyService.record(id, 'assigned', {
        fromUserId: oldAsset?.assignedToId || null,
        toUserId: data.assignedToId,
      });
    }
    if (data.status && data.status !== oldAsset?.status) {
      await historyService.record(id, 'status_changed', {
        fromStatus: oldAsset?.status || null,
        toStatus: data.status,
      });
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
