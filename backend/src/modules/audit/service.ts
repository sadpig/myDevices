import { PrismaClient, Prisma } from '@prisma/client';

export class AuditService {
  constructor(private prisma: PrismaClient) {}

  async log(userId: string, action: string, targetType: string, targetId: string, details: Prisma.InputJsonValue = {}, ipAddress?: string) {
    return this.prisma.auditLog.create({
      data: { userId, action, targetType, targetId, details, ipAddress },
    });
  }

  async list(page = 1, limit = 50, filters?: { userId?: string; action?: string; targetType?: string; startDate?: string; endDate?: string }, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const where: Record<string, unknown> = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters?.targetType) where.targetType = filters.targetType;
    if (filters?.startDate || filters?.endDate) {
      const createdAt: Record<string, Date> = {};
      if (filters.startDate) createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) createdAt.lte = new Date(filters.endDate);
      where.createdAt = createdAt;
    }

    const allowedSort = ['createdAt', 'action', 'targetType'];
    const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { logs, total, page, limit };
  }
}
