import { FastifyPluginAsync } from 'fastify';
import { ReportService } from './service.js';
import { authenticate } from '../../middleware/authenticate.js';

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  const reportService = new ReportService(fastify.prisma, fastify.redis);

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

  fastify.get('/devices/export', async (_request, reply) => {
    const data = await reportService.deviceStats();
    const csv = reportService.deviceStatsToCsv(data);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="devices-report.csv"')
      .send('\uFEFF' + csv);
  });

  fastify.get('/assets/export', async (_request, reply) => {
    const data = await reportService.assetStats();
    const csv = reportService.assetStatsToCsv(data);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="assets-report.csv"')
      .send('\uFEFF' + csv);
  });
};

export default reportRoutes;
