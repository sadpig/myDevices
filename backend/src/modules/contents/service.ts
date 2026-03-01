import { PrismaClient } from '@prisma/client';

export class ContentService {
  constructor(private prisma: PrismaClient) {}

  async list(page = 1, limit = 20, filters?: { search?: string; type?: string }) {
    const where: any = {};
    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters?.type) where.type = filters.type;
    const [contents, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { assignments: true } } },
      }),
      this.prisma.content.count({ where }),
    ]);
    return { contents, total, page, limit };
  }

  async getById(id: string) {
    return this.prisma.content.findUniqueOrThrow({
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

  async create(data: { name: string; type: string; fileUrl?: string; fileSize?: number; description?: string; version?: string }) {
    return this.prisma.content.create({
      data: {
        name: data.name,
        type: data.type,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize ? BigInt(data.fileSize) : undefined,
        description: data.description,
        version: data.version,
      },
    });
  }

  async update(id: string, data: Partial<{ name: string; type: string; description: string; version: string }>) {
    return this.prisma.content.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.content.delete({ where: { id } });
  }

  async distribute(contentId: string, targets: { deviceIds?: string[]; departmentId?: string }) {
    const assignments = [];
    if (targets.deviceIds) {
      for (const deviceId of targets.deviceIds) {
        assignments.push(
          this.prisma.contentAssignment.create({
            data: { contentId, deviceId, status: 'pending' },
          })
        );
      }
    }
    if (targets.departmentId) {
      assignments.push(
        this.prisma.contentAssignment.create({
          data: { contentId, departmentId: targets.departmentId, status: 'pending' },
        })
      );
    }
    return Promise.all(assignments);
  }

  async undistribute(contentId: string, deviceIds: string[]) {
    return this.prisma.contentAssignment.updateMany({
      where: { contentId, deviceId: { in: deviceIds } },
      data: { status: 'removed' },
    });
  }
}
