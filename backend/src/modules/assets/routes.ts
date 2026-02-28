import { FastifyPluginAsync } from 'fastify';
const assetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ message: 'assets module - TODO' }));
};
export default assetRoutes;
