import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' });
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // Register route modules
  await app.register(import('./modules/auth/routes.js'), { prefix: '/api/auth' });
  await app.register(import('./modules/devices/routes.js'), { prefix: '/api/devices' });
  await app.register(import('./modules/assets/routes.js'), { prefix: '/api/assets' });
  await app.register(import('./modules/mdm/routes.js'), { prefix: '/mdm' });
  await app.register(import('./modules/audit/routes.js'), { prefix: '/api/audit-logs' });
  await app.register(import('./modules/reports/routes.js'), { prefix: '/api/reports' });
  await app.register(import('./modules/profiles/routes.js'), { prefix: '/api/profiles' });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
