import { FastifyPluginAsync } from 'fastify';
const deviceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ message: 'devices module - TODO' }));
};
export default deviceRoutes;
