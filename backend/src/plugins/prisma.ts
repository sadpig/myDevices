import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async (fastify) => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL || 'postgresql://mydevices:mydevices_dev@localhost:5432/mydevices',
  });
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
