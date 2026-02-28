import { FastifyPluginAsync } from 'fastify';
import { AssetService } from './service.js';
import { authenticate } from '../../middleware/authenticate.js';

const assetRoutes: FastifyPluginAsync = async (fastify) => {
  const assetService = new AssetService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const { page, limit, status, department, search } = request.query as any;
    return assetService.list(parseInt(page) || 1, parseInt(limit) || 20, { status, department, search });
  });

  fastify.get('/stats', async () => {
    return assetService.stats();
  });

  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return assetService.getById(id);
  });

  fastify.post('/', async (request) => {
    const data = request.body as any;
    return assetService.create(data);
  });

  fastify.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    return assetService.update(id, data);
  });
};

export default assetRoutes;
