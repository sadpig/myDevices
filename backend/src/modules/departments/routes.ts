import { FastifyPluginAsync } from 'fastify';
import { DepartmentService } from './service.js';
import { requirePermission } from '../../middleware/authenticate.js';
import { AuditService } from '../audit/service.js';

const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  const departmentService = new DepartmentService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  fastify.get('/tree', { preHandler: requirePermission('dept:read') }, async () => {
    return departmentService.getTree();
  });

  fastify.get('/', { preHandler: requirePermission('dept:read') }, async () => {
    return departmentService.list();
  });

  fastify.get('/:id', { preHandler: requirePermission('dept:read') }, async (request) => {
    const { id } = request.params as { id: string };
    return departmentService.getById(id);
  });

  fastify.post('/', {
    preHandler: requirePermission('dept:write'),
    schema: {
      body: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string', minLength: 1 },
          code: { type: 'string', minLength: 1 },
          parentId: { type: 'string', format: 'uuid' },
          sortOrder: { type: 'integer' },
        },
      },
    },
  }, async (request) => {
    const data = request.body as { name: string; code: string; parentId?: string; sortOrder?: number };
    const result = await departmentService.create(data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'department.create', 'department', result.id, data, request.ip);
    return result;
  });

  fastify.put('/:id', {
    preHandler: requirePermission('dept:write'),
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          code: { type: 'string', minLength: 1 },
          parentId: { type: 'string', format: 'uuid' },
          sortOrder: { type: 'integer' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as { name?: string; code?: string; parentId?: string; sortOrder?: number };
    const result = await departmentService.update(id, data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'department.update', 'department', id, data, request.ip);
    return result;
  });

  fastify.delete('/:id', { preHandler: requirePermission('dept:delete') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await departmentService.remove(id);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
    const user = request.user as { id: string };
    await auditService.log(user.id, 'department.delete', 'department', id, {}, request.ip);
    return { message: 'Department removed' };
  });
};

export default departmentRoutes;
