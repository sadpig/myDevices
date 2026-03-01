import { PrismaClient, AssetStatus } from '@prisma/client';

interface AssetFilters {
  status?: AssetStatus;
  department?: string;
  search?: string;
}

export class AssetService {
  constructor(private prisma: PrismaClient) {}

  async list(page = 1, limit = 20, filters?: AssetFilters) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.department) where.department = { contains: filters.department, mode: 'insensitive' };
    if (filters?.search) {
      where.OR = [
        { assignedTo: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
        { device: { serialNumber: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: { device: { select: { serialNumber: true, deviceName: true, deviceType: true, modelName: true } } },
        orderBy: { createdAt: 'desc' },
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
      include: { device: true },
    });
  }

  async create(data: { deviceId: string; purchaseDate?: string; purchasePrice?: number; warrantyEnd?: string; assignedTo?: string; department?: string; location?: string; status?: AssetStatus; notes?: string }) {
    return this.prisma.asset.create({
      data: {
        deviceId: data.deviceId,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        purchasePrice: data.purchasePrice,
        warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : undefined,
        assignedTo: data.assignedTo,
        department: data.department,
        location: data.location,
        status: data.status || 'in_stock',
        notes: data.notes,
      },
      include: { device: true },
    });
  }

  async update(id: string, data: Partial<{ purchaseDate: string; purchasePrice: number; warrantyEnd: string; assignedTo: string; department: string; location: string; status: AssetStatus; notes: string }>) {
    const updateData: any = { ...data };
    if (data.purchaseDate) updateData.purchaseDate = new Date(data.purchaseDate);
    if (data.warrantyEnd) updateData.warrantyEnd = new Date(data.warrantyEnd);
    return this.prisma.asset.update({ where: { id }, data: updateData, include: { device: true } });
  }

  async stats() {
    const [byStatus, byDepartment, total] = await Promise.all([
      this.prisma.asset.groupBy({ by: ['status'], _count: true }),
      this.prisma.asset.groupBy({ by: ['department'], _count: true, orderBy: { _count: { department: 'desc' } }, take: 10 }),
      this.prisma.asset.count(),
    ]);
    return { byStatus, byDepartment, total };
  }

  async remove(id: string) {
    return this.prisma.asset.delete({ where: { id } });
  }
}
