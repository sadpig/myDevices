import { FastifyPluginAsync } from 'fastify';
const mdmRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ message: 'mdm module - TODO' }));
};
export default mdmRoutes;
