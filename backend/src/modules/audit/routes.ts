import { FastifyPluginAsync } from 'fastify';
import { AuditService } from './service.js';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  const auditService = new AuditService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { preHandler: [requirePermission('audit:read')] }, async (request) => {
    const { page, limit, userId, action, targetType, sortBy, sortOrder, startDate, endDate } = request.query as {
      page?: string; limit?: string; userId?: string; action?: string;
      targetType?: string; sortBy?: string; sortOrder?: string;
      startDate?: string; endDate?: string;
    };
    return auditService.list(parseInt(page || '1'), parseInt(limit || '50'), { userId, action, targetType, startDate, endDate }, sortBy, sortOrder as 'asc' | 'desc' | undefined);
  });

  fastify.get('/export', { preHandler: [requirePermission('audit:read')] }, async (request, reply) => {
    const { userId, action, targetType, startDate, endDate } = request.query as {
      userId?: string; action?: string; targetType?: string; startDate?: string; endDate?: string;
    };
    const result = await auditService.list(1, 10000, { userId, action, targetType, startDate, endDate });
    const lines = ['Time,User,Action,Target Type,Target ID,IP Address,Details'];
    for (const log of result.logs) {
      const user = (log as any).user;
      lines.push([
        new Date(log.createdAt).toISOString(),
        user?.name || log.userId,
        log.action,
        log.targetType,
        log.targetId,
        log.ipAddress || '',
        JSON.stringify(log.details || {}).replace(/"/g, '""'),
      ].map(v => `"${v}"`).join(','));
    }
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename=audit-logs.csv');
    return '\uFEFF' + lines.join('\n');
  });
};

export default auditRoutes;
