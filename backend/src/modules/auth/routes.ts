import { FastifyPluginAsync } from 'fastify';
import { AuthService } from './service.js';
import { AuditService } from '../audit/service.js';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);

  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    try {
      const user = await authService.login(email, password);
      const token = fastify.jwt.sign(
        { id: user.id, email: user.email, role: user.role.code },
        { expiresIn: '24h' }
      );
      await auditService.log(user.id, 'user.login', 'user', user.id, {}, request.ip);
      return { token, user };
    } catch {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
  });

  fastify.post('/logout', { preHandler: [authenticate] }, async (request) => {
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7);
      await fastify.redis.set(`bl:${token}`, '1', 'EX', 86400);
    }
    const { id: userId } = request.user as { id: string };
    await auditService.log(userId, 'user.logout', 'user', userId, {}, request.ip);
    return { message: 'Logged out' };
  });

  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string };
    const user = await authService.getUserById(id);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return user;
  });

  fastify.patch('/me/preferences', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['light', 'dark', 'system'] },
          language: { type: 'string', enum: ['zh', 'en'] },
        },
      },
    },
  }, async (request) => {
    const { id } = request.user as { id: string };
    const prefs = request.body as { theme?: string; language?: string };
    return authService.updatePreferences(id, prefs);
  });

  fastify.get('/users', { preHandler: [requirePermission('user:read')] }, async (request) => {
    const { page, limit, sortBy, sortOrder, departmentId, roleId, search } = request.query as any;
    const userRole = (request as any).userRole;
    const userDeptId = (request as any).userDepartmentId;
    const userId = (request.user as any).id;
    return authService.listUsers(
      parseInt(page || '1'),
      parseInt(limit || '20'),
      sortBy,
      (sortOrder as 'asc' | 'desc') || 'desc',
      { departmentId, roleId, search },
      { id: userId, dataScope: userRole, departmentId: userDeptId },
    );
  });

  fastify.post('/register', {
    preHandler: [requirePermission('user:write')],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'name', 'password', 'roleId'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          password: { type: 'string', minLength: 6, maxLength: 100 },
          roleId: { type: 'string' },
          departmentId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, name, password, roleId, departmentId } = request.body as {
      email: string;
      name: string;
      password: string;
      roleId: string;
      departmentId?: string;
    };
    try {
      const user = await authService.createUser({ email, name, password, roleId, departmentId });
      const currentUser = request.user as { id: string };
      await auditService.log(currentUser.id, 'user.create', 'user', user.id, { email, roleId }, request.ip);
      return reply.status(201).send(user);
    } catch (err: any) {
      if (err.message === 'Email already exists') return reply.status(409).send({ error: err.message });
      return reply.status(500).send({ error: 'Failed to create user' });
    }
  });

  fastify.delete('/users/:id', { preHandler: [requirePermission('user:delete')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as { id: string };
    try {
      await authService.deleteUser(id, currentUser.id);
      await auditService.log(currentUser.id, 'user.delete', 'user', id, {}, request.ip);
      return { message: 'User deleted' };
    } catch (err: any) {
      if (err.message === 'Cannot delete yourself') return reply.status(400).send({ error: err.message });
      return reply.status(500).send({ error: 'Failed to delete user' });
    }
  });

  fastify.put('/users/:id', {
    preHandler: [requirePermission('user:write')],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          roleId: { type: 'string' },
          departmentId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as { name?: string; roleId?: string; departmentId?: string };
    const user = await authService.updateUser(id, data);
    const currentUser = request.user as { id: string };
    await auditService.log(currentUser.id, 'user.update', 'user', id, data, request.ip);
    return user;
  });

  fastify.post('/change-password', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 6, maxLength: 100 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.user as { id: string };
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
    try {
      await authService.changePassword(id, currentPassword, newPassword);
      await auditService.log(id, 'user.change_password', 'user', id, {}, request.ip);
      return { message: 'Password changed' };
    } catch (err: any) {
      if (err.message === 'Current password is incorrect') return reply.status(400).send({ error: err.message });
      return reply.status(500).send({ error: 'Failed to change password' });
    }
  });
};

export default authRoutes;
