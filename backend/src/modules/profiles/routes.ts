import { FastifyPluginAsync } from 'fastify';
import { ProfileService } from './service.js';
import { authenticate } from '../../middleware/authenticate.js';

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  const profileService = new ProfileService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const { page, limit } = request.query as any;
    return profileService.list(parseInt(page) || 1, parseInt(limit) || 20);
  });

  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return profileService.getById(id);
  });

  fastify.post('/', async (request) => {
    const data = request.body as any;
    return profileService.create(data);
  });

  fastify.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    return profileService.update(id, data);
  });

  fastify.post('/:id/install', async (request) => {
    const { id } = request.params as { id: string };
    const { deviceId } = request.body as { deviceId: string };
    return profileService.installOnDevice(id, deviceId);
  });
};

export default profileRoutes;
