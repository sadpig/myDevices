import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async createUser(email: string, name: string, password: string, role: UserRole = 'readonly') {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('Email already exists');
    const passwordHash = await bcrypt.hash(password, 12);
    return this.prisma.user.create({
      data: { email, name, passwordHash, role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async listUsers(page = 1, limit = 20) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);
    return { users, total, page, limit };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async deleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) throw new Error('Cannot delete yourself');
    await this.prisma.user.delete({ where: { id } });
  }
}
