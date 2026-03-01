import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import swagger from '@fastify/swagger';
import plist from 'plist';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true });
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  await app.register(jwt, { secret: jwtSecret || 'dev-secret' });
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(swagger, {
    openapi: {
      info: { title: 'myDevices API', version: '1.0.0', description: 'Apple 设备管理系统 API' },
      servers: [{ url: 'http://localhost:3001' }],
    },
  });

  // Register plist content-type parser for MDM endpoints
  app.addContentTypeParser(
    ['application/x-apple-aspen-mdm-checkin', 'application/x-apple-aspen-mdm'],
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, plist.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

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
