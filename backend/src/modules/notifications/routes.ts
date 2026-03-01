import { FastifyPluginAsync } from 'fastify';
import { NotificationService } from '../../services/notification.js';
import { authenticate } from '../../middleware/authenticate.js';

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  const notifService = new NotificationService(fastify.prisma);

  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    const { page, limit, unreadOnly } = request.query as { page?: string; limit?: string; unreadOnly?: string };
    return notifService.list(userId, parseInt(page || '1'), parseInt(limit || '20'), unreadOnly === 'true');
  });

  fastify.get('/unread-count', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    const count = await notifService.unreadCount(userId);
    return { count };
  });

  fastify.put('/:id/read', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    const { id } = request.params as { id: string };
    await notifService.markRead(id, userId);
    return { message: 'Marked as read' };
  });

  fastify.put('/read-all', { preHandler: [authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string };
    await notifService.markAllRead(userId);
    return { message: 'All marked as read' };
  });
};

export default notificationRoutes;
