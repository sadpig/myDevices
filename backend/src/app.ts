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
import assetBatchRoutes from './modules/assets/batch-routes.js';
import mdmRoutes from './modules/mdm/routes.js';
import auditRoutes from './modules/audit/routes.js';
import reportRoutes from './modules/reports/routes.js';
import profileRoutes from './modules/profiles/routes.js';
import departmentRoutes from './modules/departments/routes.js';
import roleRoutes from './modules/roles/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import appRoutes from './modules/apps/routes.js';
import contentRoutes from './modules/contents/routes.js';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { requirePermission } from './middleware/authenticate.js';
import { initMail, resetTransporter, sendEmail } from './services/mail.js';
import { SystemSettingService } from './services/system-setting.js';
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
  initMail(app.prisma);
  await app.register(redisPlugin);
  await app.register(swagger, {
    openapi: {
      info: { title: 'myDevices API', version: '1.0.0', description: 'Apple 设备管理系统 API' },
      servers: [{ url: 'http://localhost:3001' }],
    },
  });

  await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB
  await app.register(fastifyStatic, {
    root: resolve(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
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
  await app.register(assetBatchRoutes, { prefix: '/api/assets' });
  await app.register(mdmRoutes, { prefix: '/mdm' });
  await app.register(auditRoutes, { prefix: '/api/audit-logs' });
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await app.register(profileRoutes, { prefix: '/api/profiles' });
  await app.register(departmentRoutes, { prefix: '/api/departments' });
  await app.register(roleRoutes, { prefix: '/api/roles' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(appRoutes, { prefix: '/api/apps' });
  await app.register(contentRoutes, { prefix: '/api/contents' });

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
    const settingService = new SystemSettingService(app.prisma);
    const cfg = await settingService.getMany('smtp.');
    return {
      host: cfg['smtp.host'] || '', port: cfg['smtp.port'] || '587',
      user: cfg['smtp.user'] || '', from: cfg['smtp.from'] || '',
      secure: cfg['smtp.secure'] || 'false',
    };
  });

  app.put('/api/settings/smtp', { preHandler: [requirePermission('settings:write')] }, async (request) => {
    const body = request.body as Record<string, string>;
    const settingService = new SystemSettingService(app.prisma);
    const mapping: Record<string, string> = {
      host: 'smtp.host', port: 'smtp.port', user: 'smtp.user',
      pass: 'smtp.pass', from: 'smtp.from', secure: 'smtp.secure',
    };
    const entries: Record<string, string> = {};
    for (const [key, dbKey] of Object.entries(mapping)) {
      if (body[key] !== undefined) entries[dbKey] = body[key];
    }
    await settingService.setMany(entries);
    resetTransporter();
    return { message: 'SMTP settings updated' };
  });

  app.post('/api/settings/smtp/test', { preHandler: [requirePermission('settings:write')] }, async (request, reply) => {
    const user = request.user as { id: string; email: string };
    const ok = await sendEmail(user.email, 'myDevices Test Email', '<p>This is a test email. If you received it, your SMTP configuration is correct.</p>');
    if (ok) return { message: 'Test email sent' };
    return reply.status(500).send({ error: 'Failed to send test email', code: 500 });
  });

  return app;
}
