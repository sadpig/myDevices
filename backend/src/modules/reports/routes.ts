import { FastifyPluginAsync } from 'fastify';
const reportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ message: 'reports module - TODO' }));
};
export default reportRoutes;
