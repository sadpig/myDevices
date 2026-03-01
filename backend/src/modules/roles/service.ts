import { PrismaClient, DataScope } from '@prisma/client';

export class RoleService {
  constructor(private prisma: PrismaClient) {}

  async list() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getById(id: string) {
    return this.prisma.role.findUniqueOrThrow({
      where: { id },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
  }

  async create(data: { name: string; code: string; description?: string; dataScope: DataScope; allowedProfileTypes?: string[]; permissionIds: string[] }) {
    return this.prisma.role.create({
      data: {
        name: data.name, code: data.code, description: data.description,
        dataScope: data.dataScope, allowedProfileTypes: data.allowedProfileTypes || [],
        permissions: { create: data.permissionIds.map(pid => ({ permissionId: pid })) },
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async update(id: string, data: { name?: string; description?: string; dataScope?: DataScope; allowedProfileTypes?: string[]; permissionIds?: string[] }) {
    if (data.permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.rolePermission.createMany({
        data: data.permissionIds.map(pid => ({ roleId: id, permissionId: pid })),
      });
    }
    const { permissionIds, ...updateData } = data;
    return this.prisma.role.update({
      where: { id }, data: updateData,
      include: { permissions: { include: { permission: true } } },
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    if (role.isSystem) throw new Error('系统预置角色不可删除');
    const userCount = await this.prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) throw new Error('该角色下有关联用户，无法删除');
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    return this.prisma.role.delete({ where: { id } });
  }
}
