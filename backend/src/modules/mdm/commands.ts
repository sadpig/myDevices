import { PrismaClient, CommandStatus, Prisma } from '@prisma/client';
import { APNsService } from './apns.js';

export class CommandService {
  constructor(
    private prisma: PrismaClient,
    private apns: APNsService,
  ) {}

  async queueCommand(deviceId: string, commandType: string, payload: Prisma.InputJsonValue = {}) {
    const device = await this.prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    const command = await this.prisma.mDMCommand.create({
      data: {
        deviceId,
        commandType,
        payload,
        status: 'queued',
        requestId: crypto.randomUUID(),
      },
    });

    if (device.pushToken && device.pushMagic) {
      try {
        await this.apns.sendPush(device.pushToken, device.pushMagic);
        await this.prisma.mDMCommand.update({
          where: { id: command.id },
          data: { status: 'sent', sentAt: new Date() },
        });
      } catch (err) {
        console.error('APNs push failed:', err);
      }
    }

    return command;
  }

  async getNextCommand(deviceId: string) {
    return this.prisma.mDMCommand.findFirst({
      where: { deviceId, status: { in: ['queued', 'sent'] } },
      orderBy: { queuedAt: 'asc' },
    });
  }

  async acknowledgeCommand(requestId: string, status: CommandStatus, result?: Prisma.InputJsonValue) {
    return this.prisma.mDMCommand.update({
      where: { requestId },
      data: { status, acknowledgedAt: new Date(), result: result ?? undefined },
    });
  }
}
