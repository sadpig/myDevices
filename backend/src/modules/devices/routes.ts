import { FastifyPluginAsync } from 'fastify';
import { DeviceService } from './service.js';
import { authenticate } from '../../middleware/authenticate.js';

const deviceRoutes: FastifyPluginAsync = async (fastify) => {
  const deviceService = new DeviceService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const { page, limit, deviceType, enrollmentStatus, search } = request.query as any;
    return deviceService.list(
      parseInt(page) || 1,
      parseInt(limit) || 20,
      { deviceType, enrollmentStatus, search }
    );
  });

  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return deviceService.getById(id);
  });

  fastify.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    return deviceService.update(id, data);
  });

  fastify.delete('/:id', async (request) => {
    const { id } = request.params as { id: string };
    await deviceService.remove(id);
    return { message: 'Device removed' };
  });

  fastify.get('/:id/commands', async (request) => {
    const { id } = request.params as { id: string };
    const { page, limit } = request.query as any;
    return deviceService.getCommandHistory(id, parseInt(page) || 1, parseInt(limit) || 20);
  });

  fastify.post('/:id/commands', async (request) => {
    const { id } = request.params as { id: string };
    const { commandType, payload } = request.body as { commandType: string; payload?: any };
    const command = await fastify.prisma.mDMCommand.create({
      data: {
        deviceId: id,
        commandType,
        payload: payload || {},
        status: 'queued',
        requestId: crypto.randomUUID(),
      },
    });
    return command;
  });
};

export default deviceRoutes;
