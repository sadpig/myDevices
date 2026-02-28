import { PrismaClient } from '@prisma/client';

export class ProfileService {
  constructor(private prisma: PrismaClient) {}

  async list(page = 1, limit = 20) {
    const [profiles, total] = await Promise.all([
      this.prisma.profile.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { devices: true } } },
      }),
      this.prisma.profile.count(),
    ]);
    return { profiles, total, page, limit };
  }

  async getById(id: string) {
    return this.prisma.profile.findUniqueOrThrow({
      where: { id },
      include: { devices: { include: { device: { select: { deviceName: true, serialNumber: true, deviceType: true } } } } },
    });
  }

  async create(data: { name: string; identifier: string; payloadType: string; payload: any; description?: string }) {
    return this.prisma.profile.create({ data });
  }

  async update(id: string, data: Partial<{ name: string; payloadType: string; payload: any; description: string }>) {
    return this.prisma.profile.update({ where: { id }, data });
  }

  async installOnDevice(profileId: string, deviceId: string) {
    return this.prisma.deviceProfile.create({
      data: { profileId, deviceId },
    });
  }
}
