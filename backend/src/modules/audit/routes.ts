import { FastifyPluginAsync } from 'fastify';
const auditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ message: 'audit module - TODO' }));
};
export default auditRoutes;
