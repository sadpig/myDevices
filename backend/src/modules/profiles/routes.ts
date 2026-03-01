import { FastifyPluginAsync } from 'fastify';
import { ProfileService } from './service.js';
import { AuditService } from '../audit/service.js';
import { requirePermission } from '../../middleware/authenticate.js';

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  const profileService = new ProfileService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  fastify.get('/', { preHandler: [requirePermission('profile:read')] }, async (request) => {
    const { page, limit, sortBy, sortOrder, search } = request.query as any;
    return profileService.list(parseInt(page) || 1, parseInt(limit) || 20, sortBy, sortOrder, search);
  });

  fastify.get('/:id', { preHandler: [requirePermission('profile:read')] }, async (request) => {
    const { id } = request.params as { id: string };
    return profileService.getById(id);
  });

  fastify.post('/', {
    preHandler: [requirePermission('profile:write')],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'identifier', 'payloadType', 'payload'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          identifier: { type: 'string', minLength: 1 },
          payloadType: { type: 'string', minLength: 1 },
          payload: { type: 'object' },
          description: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request) => {
    const data = request.body as any;
    const profile = await profileService.create(data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'profile.create', 'profile', profile.id, { name: data.name }, request.ip);
    return profile;
  });

  fastify.put('/:id', { preHandler: [requirePermission('profile:write')] }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const profile = await profileService.update(id, data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'profile.update', 'profile', id, data, request.ip);
    return profile;
  });

  fastify.post('/:id/install', {
    preHandler: [requirePermission('profile:deploy')],
    schema: {
      body: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          deviceId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { deviceId } = request.body as { deviceId: string };
    // Check allowedProfileTypes
    const userRole = (request as any).userRole;
    if (userRole.allowedProfileTypes && userRole.allowedProfileTypes.length > 0) {
      const profile = await profileService.getById(id);
      if (!userRole.allowedProfileTypes.includes(profile.payloadType)) {
        return reply.status(403).send({ error: '当前角色无权下发此类型配置文件' });
      }
    }
    const result = await profileService.installOnDevice(id, deviceId);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'profile.install', 'profile', id, { deviceId }, request.ip);
    return result;
  });

  fastify.delete('/:id', { preHandler: [requirePermission('profile:write')] }, async (request) => {
    const { id } = request.params as { id: string };
    const user = request.user as { id: string };
    await profileService.remove(id);
    await auditService.log(user.id, 'profile.delete', 'profile', id, {}, request.ip);
    return { message: 'Profile removed' };
  });

  fastify.delete('/:id/devices/:deviceId', { preHandler: [requirePermission('profile:write')] }, async (request) => {
    const { id, deviceId } = request.params as { id: string; deviceId: string };
    const user = request.user as { id: string };
    await profileService.uninstallFromDevice(id, deviceId);
    await auditService.log(user.id, 'profile.uninstall', 'profile', id, { deviceId }, request.ip);
    return { message: 'Profile uninstalled from device' };
  });
};

export default profileRoutes;
