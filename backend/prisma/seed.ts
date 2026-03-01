import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashSync } from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || 'postgresql://mydevices:mydevices_dev@localhost:5432/mydevices',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@mydevices.local' },
    update: {},
    create: {
      email: 'admin@mydevices.local',
      name: 'System Admin',
      role: 'super_admin',
      passwordHash: hashSync('admin123', 12),
    },
  });
  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
