import { PrismaClient } from '@prisma/client';

export class SystemSettingService {
  constructor(private prisma: PrismaClient) {}

  async get(key: string): Promise<string | null> {
    const s = await this.prisma.systemSetting.findUnique({ where: { key } });
    return s?.value ?? null;
  }

  async getMany(prefix: string): Promise<Record<string, string>> {
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: prefix } },
    });
    return Object.fromEntries(settings.map((s: { key: string; value: string }) => [s.key, s.value]));
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async setMany(entries: Record<string, string>): Promise<void> {
    await this.prisma.$transaction(
      Object.entries(entries).map(([key, value]) =>
        this.prisma.systemSetting.upsert({
          where: { key }, update: { value }, create: { key, value },
        })
      )
    );
  }
}
