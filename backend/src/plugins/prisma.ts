import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async (fastify) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl && process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL environment variable is required in production');
  }
  const adapter = new PrismaPg({
    connectionString: dbUrl || 'postgresql://mydevices:mydevices_dev@localhost:5432/mydevices',
  });
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
