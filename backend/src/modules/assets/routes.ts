import { FastifyPluginAsync } from 'fastify';
import { AssetService } from './service.js';
import { AuditService } from '../audit/service.js';
import { requirePermission } from '../../middleware/authenticate.js';

const assetRoutes: FastifyPluginAsync = async (fastify) => {
  const assetService = new AssetService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  fastify.get('/', { preHandler: [requirePermission('asset:read')] }, async (request) => {
    const { page, limit, status, departmentId, search, sortBy, sortOrder } = request.query as any;
    return assetService.list(parseInt(page) || 1, parseInt(limit) || 20, { status, departmentId, search }, sortBy, sortOrder);
  });

  fastify.get('/stats', { preHandler: [requirePermission('asset:read')] }, async () => {
    return assetService.stats();
  });

  fastify.get('/:id', { preHandler: [requirePermission('asset:read')] }, async (request) => {
    const { id } = request.params as { id: string };
    return assetService.getById(id);
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
  }, async (request) => {
    const data = request.body as any;
    const asset = await assetService.create(data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'asset.create', 'asset', asset.id, data, request.ip);
    return asset;
  });

  fastify.put('/:id', { preHandler: [requirePermission('asset:write')] }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const asset = await assetService.update(id, data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'asset.update', 'asset', id, data, request.ip);
    return asset;
  });

  fastify.delete('/:id', { preHandler: [requirePermission('asset:delete')] }, async (request) => {
    const { id } = request.params as { id: string };
    const user = request.user as { id: string };
    await assetService.remove(id);
    await auditService.log(user.id, 'asset.delete', 'asset', id, {}, request.ip);
    return { message: 'Asset removed' };
  });
};

export default assetRoutes;
