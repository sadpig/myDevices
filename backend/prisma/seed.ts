import { PrismaClient, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@mydevices.local' },
    update: {},
    create: {
      email: 'admin@mydevices.local',
      name: 'System Admin',
      role: UserRole.super_admin,
      passwordHash: hashSync('admin123', 10),
    },
  });
  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
