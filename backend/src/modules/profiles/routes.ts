import { FastifyPluginAsync } from 'fastify';
const profileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ message: 'profiles module - TODO' }));
};
export default profileRoutes;
