import { PrismaClient, Prisma } from '@prisma/client';

export class AssetHistoryService {
  constructor(private prisma: PrismaClient) {}

  async record(assetId: string, action: string, data: {
    fromUserId?: string | null; toUserId?: string | null;
    fromStatus?: string | null; toStatus?: string | null;
    details?: Prisma.InputJsonValue;
  }) {
    return this.prisma.assetHistory.create({
      data: { assetId, action, ...data },
    });
  }

  async list(assetId: string, page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.assetHistory.findMany({
        where: { assetId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.assetHistory.count({ where: { assetId } }),
    ]);
    return { items, total, page, limit };
  }
}
