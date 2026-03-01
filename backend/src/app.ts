import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import swagger from '@fastify/swagger';
import plist from 'plist';
import authRoutes from './modules/auth/routes.js';
import deviceRoutes from './modules/devices/routes.js';
import assetRoutes from './modules/assets/routes.js';
import mdmRoutes from './modules/mdm/routes.js';
import auditRoutes from './modules/audit/routes.js';
import reportRoutes from './modules/reports/routes.js';
import profileRoutes from './modules/profiles/routes.js';

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
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(deviceRoutes, { prefix: '/api/devices' });
  await app.register(assetRoutes, { prefix: '/api/assets' });
  await app.register(mdmRoutes, { prefix: '/mdm' });
  await app.register(auditRoutes, { prefix: '/api/audit-logs' });
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await app.register(profileRoutes, { prefix: '/api/profiles' });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
