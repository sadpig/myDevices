import { PrismaClient } from '@prisma/client';

export class DepartmentService {
  constructor(private prisma: PrismaClient) {}

  async getTree() {
    const departments = await this.prisma.department.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
    return this.buildTree(departments, null);
  }

  private buildTree(departments: any[], parentId: string | null): any[] {
    return departments
      .filter(d => d.parentId === parentId)
      .map(d => ({ ...d, children: this.buildTree(departments, d.id) }));
  }

  async list() {
    return this.prisma.department.findMany({
      orderBy: [{ sortOrder: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
  }

  async getById(id: string) {
    return this.prisma.department.findUniqueOrThrow({
      where: { id },
      include: { parent: true, children: true, _count: { select: { users: true } } },
    });
  }

  async create(data: { name: string; code: string; parentId?: string; sortOrder?: number }) {
    return this.prisma.department.create({ data });
  }

  async update(id: string, data: { name?: string; code?: string; parentId?: string; sortOrder?: number }) {
    return this.prisma.department.update({ where: { id }, data });
  }

  async remove(id: string) {
    const children = await this.prisma.department.count({ where: { parentId: id } });
    if (children > 0) throw new Error('该部门下有子部门，无法删除');
    const users = await this.prisma.user.count({ where: { departmentId: id } });
    if (users > 0) throw new Error('该部门下有人员，无法删除');
    return this.prisma.department.delete({ where: { id } });
  }
}
