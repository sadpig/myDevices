import { FastifyPluginAsync } from 'fastify';
import { RoleService } from './service.js';
import { AuditService } from '../audit/service.js';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';

const roleRoutes: FastifyPluginAsync = async (fastify) => {
  const roleService = new RoleService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/permissions', { preHandler: requirePermission('role:read') }, async () => {
    const permissions = await fastify.prisma.permission.findMany({ orderBy: { sortOrder: 'asc' } });
    const grouped: Record<string, any[]> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return grouped;
  });

  fastify.get('/', { preHandler: requirePermission('role:read') }, async () => {
    return roleService.list();
  });

  fastify.get('/:id', { preHandler: requirePermission('role:read') }, async (request) => {
    const { id } = request.params as { id: string };
    return roleService.getById(id);
  });

  fastify.post('/', {
    preHandler: requirePermission('role:write'),
    schema: {
      body: {
        type: 'object',
        required: ['name', 'code', 'dataScope', 'permissionIds'],
        properties: {
          name: { type: 'string', minLength: 1 },
          code: { type: 'string', minLength: 1 },
          dataScope: { type: 'string', enum: ['ALL', 'DEPARTMENT', 'SELF'] },
          permissionIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          description: { type: 'string' },
          allowedProfileTypes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request) => {
    const data = request.body as any;
    const role = await roleService.create(data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'role.create', 'role', role.id, { name: data.name, code: data.code }, request.ip);
    return role;
  });

  fastify.put('/:id', {
    preHandler: requirePermission('role:write'),
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          dataScope: { type: 'string', enum: ['ALL', 'DEPARTMENT', 'SELF'] },
          permissionIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          allowedProfileTypes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const role = await roleService.update(id, data);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'role.update', 'role', id, data, request.ip);
    return role;
  });

  fastify.delete('/:id', { preHandler: requirePermission('role:delete') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await roleService.remove(id);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'role.delete', 'role', id, {}, request.ip);
      return { message: 'Role removed' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};

export default roleRoutes;
