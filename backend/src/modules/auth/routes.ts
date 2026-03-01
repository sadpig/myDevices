import { FastifyPluginAsync } from 'fastify';
import { AuthService } from './service.js';
import { AuditService } from '../audit/service.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';

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
        { id: user.id, email: user.email, role: user.role },
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
      // 黑名单 TTL 24h，与 JWT 过期时间一致
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

  // User management — super_admin only
  fastify.get('/users', { preHandler: [requireRole('super_admin')] }, async (request) => {
    const { page, limit } = request.query as { page?: string; limit?: string };
    return authService.listUsers(parseInt(page || '1'), parseInt(limit || '20'));
  });

  fastify.post('/register', {
    preHandler: [requireRole('super_admin')],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'name', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          password: { type: 'string', minLength: 6, maxLength: 100 },
          role: { type: 'string', enum: ['super_admin', 'device_admin', 'readonly'] },
        },
      },
    },
  }, async (request, reply) => {
    const { email, name, password, role } = request.body as { email: string; name: string; password: string; role?: string };
    try {
      const user = await authService.createUser(email, name, password, (role as any) || 'readonly');
      const currentUser = request.user as { id: string };
      await auditService.log(currentUser.id, 'user.create', 'user', user.id, { email, role }, request.ip);
      return reply.status(201).send(user);
    } catch (err: any) {
      if (err.message === 'Email already exists') return reply.status(409).send({ error: err.message });
      return reply.status(500).send({ error: 'Failed to create user' });
    }
  });

  fastify.delete('/users/:id', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
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
