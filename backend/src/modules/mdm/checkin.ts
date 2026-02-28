import { PrismaClient, DeviceType } from '@prisma/client';

export class CheckinService {
  constructor(private prisma: PrismaClient) {}

  async handleAuthenticate(udid: string, serialNumber: string, model: string, deviceName: string, osVersion: string, deviceType: string) {
    return this.prisma.device.upsert({
      where: { udid },
      update: { serialNumber, model, deviceName, osVersion, lastSeenAt: new Date() },
      create: {
        udid,
        serialNumber,
        deviceType: this.mapDeviceType(deviceType),
        model,
        deviceName,
        osVersion,
        enrollmentStatus: 'pending',
      },
    });
  }

  async handleTokenUpdate(udid: string, pushMagic: string, pushToken: string, unlockToken?: string) {
    return this.prisma.device.update({
      where: { udid },
      data: {
        pushMagic,
        pushToken,
        unlockToken,
        enrollmentStatus: 'enrolled',
        mdmEnrolled: true,
        lastSeenAt: new Date(),
      },
    });
  }

  async handleCheckOut(udid: string) {
    return this.prisma.device.update({
      where: { udid },
      data: {
        enrollmentStatus: 'unenrolled',
        mdmEnrolled: false,
        pushMagic: null,
        pushToken: null,
        lastSeenAt: new Date(),
      },
    });
  }

  private mapDeviceType(type: string): DeviceType {
    const map: Record<string, DeviceType> = {
      'iPhone': 'iPhone', 'iPad': 'iPad', 'Mac': 'Mac',
      'AppleTV': 'AppleTV', 'AppleWatch': 'AppleWatch', 'RealityDevice': 'VisionPro',
    };
    return map[type] || 'iPhone';
  }
}
