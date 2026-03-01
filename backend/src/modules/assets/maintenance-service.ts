import { PrismaClient } from '@prisma/client';

export class MaintenanceService {
  constructor(private prisma: PrismaClient) {}

  async create(assetId: string, data: {
    reason: string; vendor?: string; cost?: number;
    startDate: string; endDate?: string; notes?: string;
  }) {
    return this.prisma.maintenanceRecord.create({
      data: {
        assetId,
        reason: data.reason,
        vendor: data.vendor,
        cost: data.cost,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        notes: data.notes,
      },
    });
  }

  async list(assetId: string) {
    return this.prisma.maintenanceRecord.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    return this.prisma.maintenanceRecord.delete({ where: { id } });
  }
}
