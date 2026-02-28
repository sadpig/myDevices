import { FastifyPluginAsync } from 'fastify';
import { AuditService } from './service.js';
import { authenticate } from '../../middleware/authenticate.js';

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  const auditService = new AuditService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const { page, limit, userId, action, targetType } = request.query as any;
    return auditService.list(parseInt(page) || 1, parseInt(limit) || 50, { userId, action, targetType });
  });
};

export default auditRoutes;
