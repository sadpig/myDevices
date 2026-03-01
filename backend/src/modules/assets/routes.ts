import { FastifyPluginAsync } from 'fastify';
import { AssetStatus, Prisma } from '@prisma/client';
import { AssetService } from './service.js';
import { AuditService } from '../audit/service.js';
import { AssetHistoryService } from './history-service.js';
import { MaintenanceService } from './maintenance-service.js';
import { requirePermission } from '../../middleware/authenticate.js';

interface AssetListQuery {
  page?: string; limit?: string; status?: string;
  departmentId?: string; search?: string; sortBy?: string; sortOrder?: string;
}

interface AssetBody {
  deviceId: string; purchaseDate?: string; purchasePrice?: number;
  warrantyEnd?: string; assignedToId?: string; departmentId?: string;
  location?: string; status?: AssetStatus; notes?: string;
}

const assetRoutes: FastifyPluginAsync = async (fastify) => {
  const assetService = new AssetService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);
  const historyService = new AssetHistoryService(fastify.prisma);
  const maintenanceService = new MaintenanceService(fastify.prisma);

  fastify.get('/', { preHandler: [requirePermission('asset:read')] }, async (request) => {
    const { page, limit, status, departmentId, search, sortBy, sortOrder } = request.query as AssetListQuery;
    return assetService.list(parseInt(page || '1'), parseInt(limit || '20'), { status: status as AssetStatus | undefined, departmentId, search }, sortBy, sortOrder as 'asc' | 'desc' | undefined);
  });

  fastify.get('/stats', { preHandler: [requirePermission('asset:read')] }, async () => {
    return assetService.stats();
  });

  fastify.get('/:id', { preHandler: [requirePermission('asset:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await assetService.getById(id);
    } catch (err: unknown) {
      const e = err as { code?: string; name?: string };
      if (e.code === 'P2025' || e.name === 'NotFoundError') {
        return reply.status(404).send({ error: 'Asset not found', code: 404 });
      }
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal server error', code: 500 });
    }
  });

  fastify.post('/', {
    preHandler: [requirePermission('asset:write')],
    schema: {
      body: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          deviceId: { type: 'string', format: 'uuid' },
          purchaseDate: { type: 'string' },
          purchasePrice: { type: 'number', minimum: 0 },
          warrantyEnd: { type: 'string' },
          assignedToId: { type: 'string', format: 'uuid' },
          department: { type: 'string', maxLength: 100 },
          location: { type: 'string', maxLength: 200 },
          status: { type: 'string', enum: ['in_use', 'in_stock', 'repairing', 'retired', 'lost'] },
          notes: { type: 'string', maxLength: 1000 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const data = request.body as AssetBody;
      const asset = await assetService.create(data);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'asset.create', 'asset', asset.id, data as unknown as Prisma.InputJsonValue, request.ip);
      return asset;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to create asset', code: 500 });
    }
  });

  fastify.put('/:id', { preHandler: [requirePermission('asset:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const data = request.body as Partial<AssetBody>;
      const asset = await assetService.update(id, data);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'asset.update', 'asset', id, data as unknown as Prisma.InputJsonValue, request.ip);
      return asset;
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2025') return reply.status(404).send({ error: 'Asset not found', code: 404 });
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update asset', code: 500 });
    }
  });

  fastify.delete('/:id', { preHandler: [requirePermission('asset:delete')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const user = request.user as { id: string };
      await assetService.remove(id);
      await auditService.log(user.id, 'asset.delete', 'asset', id, {}, request.ip);
      return { message: 'Asset removed' };
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2025') return reply.status(404).send({ error: 'Asset not found', code: 404 });
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to delete asset', code: 500 });
    }
  });

  // Asset history
  fastify.get('/:id/history', { preHandler: [requirePermission('asset:read')] }, async (request) => {
    const { id } = request.params as { id: string };
    const { page, limit } = request.query as { page?: string; limit?: string };
    return historyService.list(id, parseInt(page || '1'), parseInt(limit || '20'));
  });

  // Maintenance records
  fastify.get('/:id/maintenance', { preHandler: [requirePermission('asset:read')] }, async (request) => {
    const { id } = request.params as { id: string };
    return maintenanceService.list(id);
  });

  fastify.post('/:id/maintenance', { preHandler: [requirePermission('asset:write')] }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as { reason: string; vendor?: string; cost?: number; startDate: string; endDate?: string; notes?: string };
    return maintenanceService.create(id, data);
  });

  fastify.delete('/:id/maintenance/:mid', { preHandler: [requirePermission('asset:write')] }, async (request, reply) => {
    const { mid } = request.params as { id: string; mid: string };
    try {
      await maintenanceService.remove(mid);
      return { message: 'Record removed' };
    } catch {
      return reply.status(404).send({ error: 'Record not found', code: 404 });
    }
  });
};

export default assetRoutes;
