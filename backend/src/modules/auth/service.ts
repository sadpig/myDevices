import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getDepartmentAndChildrenIds } from '../../middleware/data-scope.js';

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        department: true,
      },
    });
    if (!user) throw new Error('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');
    const permissions = user.role.permissions.map((rp: any) => rp.permission.code as string);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: {
        id: user.role.id,
        code: user.role.code,
        name: user.role.name,
        dataScope: user.role.dataScope,
      },
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
      permissions,
      preferences: user.preferences,
    };
  }

  async createUser(data: { email: string; name: string; password: string; roleId: string; departmentId?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Email already exists');
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        roleId: data.roleId,
        departmentId: data.departmentId,
      },
      select: { id: true, email: true, name: true, role: true, department: true, createdAt: true },
    });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        department: true,
      },
    });
    if (!user) return null;
    const permissions = user.role.permissions.map((rp: any) => rp.permission.code as string);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: {
        id: user.role.id,
        code: user.role.code,
        name: user.role.name,
        dataScope: user.role.dataScope,
      },
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
      permissions,
      preferences: user.preferences,
      createdAt: user.createdAt,
    };
  }

  async listUsers(
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    filters?: { departmentId?: string; roleId?: string; search?: string },
    currentUser?: { id: string; dataScope: string; departmentId?: string | null },
  ) {
    const allowedSort = ['createdAt', 'name', 'email'];
    const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const where: any = {};

    // Data scope filtering
    if (currentUser) {
      if (currentUser.dataScope === 'department' && currentUser.departmentId) {
        const deptIds = await getDepartmentAndChildrenIds(this.prisma, currentUser.departmentId);
        where.departmentId = { in: deptIds };
      } else if (currentUser.dataScope === 'self') {
        where.id = currentUser.id;
      }
      // 'all' scope: no restriction
    }

    // Additional filters
    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }
    if (filters?.roleId) {
      where.roleId = filters.roleId;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          department: true,
          createdAt: true,
        },
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total, page, limit };
  }

  async updateUser(id: string, data: { name?: string; roleId?: string; departmentId?: string }) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, department: true, createdAt: true },
    });
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

  async updatePreferences(userId: string, preferences: { theme?: string; language?: string }) {
    const allowed: Record<string, string> = {};
    if (preferences.theme) allowed.theme = preferences.theme;
    if (preferences.language) allowed.language = preferences.language;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const current = ((user as any).preferences as Record<string, unknown>) || {};
    const merged: Record<string, unknown> = { ...current, ...allowed };
    return this.prisma.user.update({
      where: { id: userId },
      data: { preferences: merged as any },
      select: { id: true, preferences: true },
    });
  }
}
