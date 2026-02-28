import { FastifyPluginAsync } from 'fastify';
import { AuthService } from './service.js';
import { authenticate } from '../../middleware/authenticate.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService(fastify.prisma);

  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    try {
      const user = await authService.login(email, password);
      const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
      return { token, user };
    } catch {
      reply.status(401).send({ error: 'Invalid credentials' });
    }
  });

  fastify.post('/logout', async () => {
    return { message: 'Logged out' };
  });

  fastify.get('/me', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.user as { id: string };
    const user = await authService.getUserById(id);
    if (!user) throw new Error('User not found');
    return user;
  });
};

export default authRoutes;
