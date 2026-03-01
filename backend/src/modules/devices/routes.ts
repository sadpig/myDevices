import { FastifyPluginAsync } from 'fastify';
import { DeviceService } from './service.js';
import { requirePermission } from '../../middleware/authenticate.js';
import { CommandService } from '../mdm/commands.js';
import { APNsService } from '../mdm/apns.js';
import { AuditService } from '../audit/service.js';

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

  fastify.get('/', { preHandler: [requirePermission('device:read')] }, async (request) => {
    const { page, limit, deviceType, enrollmentStatus, search, sortBy, sortOrder } = request.query as any;
    return deviceService.list(
      parseInt(page) || 1,
      parseInt(limit) || 20,
      { deviceType, enrollmentStatus, search },
      sortBy,
      sortOrder
    );
  });

  fastify.get('/:id', { preHandler: [requirePermission('device:read')] }, async (request) => {
    const { id } = request.params as { id: string };
    return deviceService.getById(id);
  });

  fastify.put('/:id', { preHandler: [requirePermission('device:write')] }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const result = await deviceService.update(id, data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'device.update', 'device', id, data, request.ip);
    return result;
  });

  fastify.delete('/:id', { preHandler: [requirePermission('device:delete')] }, async (request) => {
    const { id } = request.params as { id: string };
    await deviceService.remove(id);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'device.delete', 'device', id, {}, request.ip);
    return { message: 'Device removed' };
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
          commandType: { type: 'string', minLength: 1 },
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
    return result;
  });
};

export default deviceRoutes;
