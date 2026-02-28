import { FastifyPluginAsync } from 'fastify';
import { ReportService } from './service.js';
import { authenticate } from '../../middleware/authenticate.js';

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  const reportService = new ReportService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/devices', async () => {
    return reportService.deviceStats();
  });

  fastify.get('/assets', async () => {
    return reportService.assetStats();
  });

  fastify.get('/compliance', async () => {
    return reportService.compliance();
  });
};

export default reportRoutes;
