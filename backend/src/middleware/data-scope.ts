import { PrismaClient } from '@prisma/client';

export async function getDepartmentAndChildrenIds(prisma: PrismaClient, departmentId: string): Promise<string[]> {
  const result: string[] = [departmentId];
  const children = await prisma.department.findMany({ where: { parentId: departmentId }, select: { id: true } });
  for (const child of children) {
    const childIds = await getDepartmentAndChildrenIds(prisma, child.id);
    result.push(...childIds);
  }
  return result;
}
