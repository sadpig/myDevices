import { PrismaClient } from '@prisma/client';
import { sendEmail } from './mail.js';

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  async create(userId: string, title: string, content: string, type: string) {
    return this.prisma.notification.create({
      data: { userId, title, content, type },
    });
  }

  async createAndEmail(userId: string, title: string, content: string, type: string) {
    const notification = await this.create(userId, title, content, type);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      await sendEmail(user.email, title, content);
    }
    return notification;
  }

  async list(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const where: any = { userId };
    if (unreadOnly) where.read = false;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { notifications, total, page, limit };
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }
}
