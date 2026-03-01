import { FastifyRequest, FastifyReply } from 'fastify';

async function isTokenBlacklisted(request: FastifyRequest, token: string): Promise<boolean> {
  try {
    const result = await request.server.redis.get(`bl:${token}`);
    return result !== null;
  } catch {
    return false;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const token = extractToken(request);
    if (token && await isTokenBlacklisted(request, token)) {
      return reply.status(401).send({ error: 'Token has been revoked' });
    }
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const token = extractToken(request);
      if (token && await isTokenBlacklisted(request, token)) {
        return reply.status(401).send({ error: 'Token has been revoked' });
      }
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const user = request.user as { role: string };
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  };
}
