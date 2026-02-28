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
}
