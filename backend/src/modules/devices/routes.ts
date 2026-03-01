import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { DeviceService } from './service.js';
import { requirePermission } from '../../middleware/authenticate.js';
import { CommandService } from '../mdm/commands.js';
import { APNsService } from '../mdm/apns.js';
import { AuditService } from '../audit/service.js';
import { NotificationService } from '../../services/notification.js';
import { emailTemplates } from '../../services/email-templates.js';

const deviceRoutes: FastifyPluginAsync = async (fastify) => {
  const deviceService = new DeviceService(fastify.prisma);
  const apnsService = new APNsService({
    keyId: process.env.APNS_KEY_ID || '',
    teamId: process.env.APNS_TEAM_ID || '',
    keyPath: process.env.APNS_KEY_PATH || '',
    topic: process.env.APNS_TOPIC || '',
    production: process.env.NODE_ENV === 'production',
  });
  const commandService = new CommandService(fastify.prisma, apnsService);
  const auditService = new AuditService(fastify.prisma);

  interface DeviceListQuery {
    page?: string; limit?: string; deviceType?: string;
    enrollmentStatus?: string; search?: string; sortBy?: string; sortOrder?: string;
  }

  interface DeviceUpdateBody {
    deviceName?: string; osVersion?: string; enrollmentStatus?: string;
  }

  fastify.get('/search', { preHandler: [requirePermission('device:read')] }, async (request) => {
    const { q } = request.query as { q?: string };
    if (!q || q.length < 2) return { devices: [] };
    const devices = await fastify.prisma.device.findMany({
      where: {
        asset: null,
        OR: [
          { deviceName: { contains: q, mode: 'insensitive' } },
          { serialNumber: { contains: q, mode: 'insensitive' } },
          { modelName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, deviceName: true, serialNumber: true, modelName: true, deviceType: true },
      take: 20,
    });
    return { devices };
  });

  fastify.get('/', { preHandler: [requirePermission('device:read')] }, async (request) => {
    const { page, limit, deviceType, enrollmentStatus, search, sortBy, sortOrder } = request.query as DeviceListQuery;
    return deviceService.list(
      parseInt(page || '1'),
      parseInt(limit || '20'),
      { deviceType: deviceType as any, enrollmentStatus: enrollmentStatus as any, search },
      sortBy,
      sortOrder as 'asc' | 'desc' | undefined
    );
  });

  fastify.get('/:id', { preHandler: [requirePermission('device:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await deviceService.getById(id);
    } catch (err: unknown) {
      const e = err as { code?: string; name?: string };
      if (e.code === 'P2025' || e.name === 'NotFoundError') {
        return reply.status(404).send({ error: 'Device not found', code: 404 });
      }
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal server error', code: 500 });
    }
  });

  fastify.put('/:id', { preHandler: [requirePermission('device:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as DeviceUpdateBody;
    try {
      const result = await deviceService.update(id, data);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'device.update', 'device', id, data as unknown as Prisma.InputJsonValue, request.ip);
      return result;
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2025') return reply.status(404).send({ error: 'Device not found', code: 404 });
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update device', code: 500 });
    }
  });

  fastify.delete('/:id', { preHandler: [requirePermission('device:delete')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deviceService.remove(id);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'device.delete', 'device', id, {}, request.ip);
      return { message: 'Device removed' };
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2025') return reply.status(404).send({ error: 'Device not found', code: 404 });
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to delete device', code: 500 });
    }
  });

  fastify.get('/:id/commands', { preHandler: [requirePermission('device:read')] }, async (request) => {
    const { id } = request.params as { id: string };
    const { page, limit } = request.query as any;
    return deviceService.getCommandHistory(id, parseInt(page) || 1, parseInt(limit) || 20);
  });

  fastify.post('/:id/commands', {
    preHandler: [requirePermission('mdm:command')],
    schema: {
      body: {
        type: 'object',
        required: ['commandType'],
        properties: {
          commandType: {
            type: 'string',
            enum: [
              'DeviceInformation', 'SecurityInfo', 'InstalledApplicationList',
              'DeviceLock', 'EraseDevice', 'ClearPasscode',
              'InstallProfile', 'RemoveProfile',
              'InstallApplication', 'RemoveApplication', 'InstallMedia',
              'RestartDevice', 'ShutDownDevice',
            ],
          },
          payload: { type: 'object' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { commandType, payload } = request.body as { commandType: string; payload?: any };
    const result = await commandService.queueCommand(id, commandType, payload || {});
    const user = request.user as { id: string };
    await auditService.log(user.id, 'device.command', 'device', id, { commandType }, request.ip);

    // Notify assigned user for critical commands
    const criticalCommands = ['DeviceLock', 'EraseDevice', 'ClearPasscode'];
    if (criticalCommands.includes(commandType)) {
      try {
        const asset = await fastify.prisma.asset.findFirst({
          where: { deviceId: id },
          include: { device: true, assignedUser: { select: { id: true, name: true } } },
        });
        if (asset?.assignedToId && asset.assignedUser) {
          const notifService = new NotificationService(fastify.prisma);
          const tmpl = emailTemplates.mdmCommandAlert({
            userName: asset.assignedUser.name,
            deviceName: asset.device?.deviceName || asset.device?.serialNumber || id,
            commandType,
          });
          await notifService.createAndEmail(asset.assignedToId, tmpl.subject, tmpl.html, 'mdm_command');
        }
      } catch { /* non-critical, don't block the command */ }
    }

    return result;
  });
};

export default deviceRoutes;
