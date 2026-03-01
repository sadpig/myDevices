import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { AppService } from './service.js';
import { requirePermission } from '../../middleware/authenticate.js';
import { AuditService } from '../audit/service.js';

const appRoutes: FastifyPluginAsync = async (fastify) => {
  const appService = new AppService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  fastify.get('/', { preHandler: [requirePermission('app:read')] }, async (request) => {
    const { page, limit, search, category } = request.query as { page?: string; limit?: string; search?: string; category?: string };
    return appService.list(parseInt(page || '1'), parseInt(limit || '20'), { search, category });
  });

  fastify.get('/:id', { preHandler: [requirePermission('app:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await appService.getById(id);
    } catch (err: unknown) {
      const e = err as { code?: string; name?: string };
      if (e.code === 'P2025' || e.name === 'NotFoundError') {
        return reply.status(404).send({ error: 'App not found', code: 404 });
      }
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal server error', code: 500 });
    }
  });

  fastify.post('/', { preHandler: [requirePermission('app:write')] }, async (request) => {
    const data = request.body as { bundleId: string; name: string; version?: string; category?: string; managedApp?: boolean; source?: string };
    const app = await appService.create(data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'app.create', 'app', app.id, data as unknown as Prisma.InputJsonValue, request.ip);
    return app;
  });

  fastify.put('/:id', { preHandler: [requirePermission('app:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as Partial<{ name: string; version: string; category: string; managedApp: boolean; source: string }>;
    try {
      const app = await appService.update(id, data);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'app.update', 'app', id, data as unknown as Prisma.InputJsonValue, request.ip);
      return app;
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2025') return reply.status(404).send({ error: 'App not found', code: 404 });
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update app', code: 500 });
    }
  });

  fastify.delete('/:id', { preHandler: [requirePermission('app:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await appService.remove(id);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'app.delete', 'app', id, {} as Prisma.InputJsonValue, request.ip);
      return { message: 'App removed' };
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2025') return reply.status(404).send({ error: 'App not found', code: 404 });
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to delete app', code: 500 });
    }
  });

  fastify.post('/:id/install', { preHandler: [requirePermission('app:deploy')] }, async (request) => {
    const { id } = request.params as { id: string };
    const { deviceIds, departmentId } = request.body as { deviceIds?: string[]; departmentId?: string };
    const results = await appService.install(id, { deviceIds, departmentId });
    const user = request.user as { id: string };
    await auditService.log(user.id, 'app.install', 'app', id, { deviceIds, departmentId } as unknown as Prisma.InputJsonValue, request.ip);
    return { installed: results.length };
  });

  fastify.post('/:id/uninstall', { preHandler: [requirePermission('app:deploy')] }, async (request) => {
    const { id } = request.params as { id: string };
    const { deviceIds } = request.body as { deviceIds: string[] };
    await appService.uninstall(id, deviceIds);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'app.uninstall', 'app', id, { deviceIds } as unknown as Prisma.InputJsonValue, request.ip);
    return { message: 'Uninstall initiated' };
  });
};

export default appRoutes;
