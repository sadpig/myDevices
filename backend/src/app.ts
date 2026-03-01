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
import departmentRoutes from './modules/departments/routes.js';
import roleRoutes from './modules/roles/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import { requirePermission } from './middleware/authenticate.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export async function buildApp() {
  (BigInt.prototype as any).toJSON = function () { return Number(this); };

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
  await app.register(departmentRoutes, { prefix: '/api/departments' });
  await app.register(roleRoutes, { prefix: '/api/roles' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });

  app.get('/health', async () => ({ status: 'ok' }));

  // APNs settings endpoints
  app.get('/api/settings/apns', { preHandler: [requirePermission('settings:read')] }, async () => {
    const keyPath = process.env.APNS_KEY_PATH || '';
    return {
      keyId: process.env.APNS_KEY_ID || '',
      teamId: process.env.APNS_TEAM_ID || '',
      keyPath,
      topic: process.env.APNS_TOPIC || '',
      keyFileExists: keyPath ? existsSync(keyPath) : false,
    };
  });

  app.put('/api/settings/apns', { preHandler: [requirePermission('settings:write')] }, async (request) => {
    const { keyId, teamId, keyPath, topic } = request.body as { keyId?: string; teamId?: string; keyPath?: string; topic?: string };
    const envPath = resolve(process.cwd(), '.env');
    let envContent = '';
    try { envContent = readFileSync(envPath, 'utf-8'); } catch { envContent = ''; }

    const updates: Record<string, string> = {};
    if (keyId !== undefined) updates.APNS_KEY_ID = keyId;
    if (teamId !== undefined) updates.APNS_TEAM_ID = teamId;
    if (keyPath !== undefined) updates.APNS_KEY_PATH = keyPath;
    if (topic !== undefined) updates.APNS_TOPIC = topic;

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
      process.env[key] = value;
    }

    writeFileSync(envPath, envContent.trim() + '\n');
    return { message: 'APNs settings updated' };
  });

  app.get('/api/settings/smtp', { preHandler: [requirePermission('settings:read')] }, async () => {
    return {
      host: process.env.SMTP_HOST || '',
      port: process.env.SMTP_PORT || '587',
      user: process.env.SMTP_USER || '',
      from: process.env.SMTP_FROM || '',
      secure: process.env.SMTP_SECURE || 'false',
    };
  });

  app.put('/api/settings/smtp', { preHandler: [requirePermission('settings:write')] }, async (request) => {
    const body = request.body as Record<string, string>;
    const envPath = resolve(process.cwd(), '.env');
    let envContent = '';
    try { envContent = readFileSync(envPath, 'utf-8'); } catch { envContent = ''; }

    const mapping: Record<string, string> = {
      host: 'SMTP_HOST', port: 'SMTP_PORT', user: 'SMTP_USER',
      pass: 'SMTP_PASS', from: 'SMTP_FROM', secure: 'SMTP_SECURE',
    };

    for (const [key, envKey] of Object.entries(mapping)) {
      if (body[key] !== undefined) {
        const regex = new RegExp(`^${envKey}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${envKey}=${body[key]}`);
        } else {
          envContent += `\n${envKey}=${body[key]}`;
        }
        process.env[envKey] = body[key];
      }
    }
    writeFileSync(envPath, envContent.trim() + '\n');

    const { resetTransporter } = await import('./services/mail.js');
    resetTransporter();

    return { message: 'SMTP settings updated' };
  });

  return app;
}
