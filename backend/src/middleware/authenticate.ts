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
    const payload = request.user as { id: string };
    const user = await request.server.prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true },
    });
    if (!user || !user.role || !roles.includes(user.role.code)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  };
}

export function requirePermission(...codes: string[]) {
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
    const payload = request.user as { id: string };
    const user = await request.server.prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user || !user.role) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const userPermissions = user.role.permissions.map((rp: any) => rp.permission.code);
    const hasPermission = codes.some(code => userPermissions.includes(code));
    if (!hasPermission) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    (request as any).userPermissions = userPermissions;
    (request as any).userRole = user.role;
    (request as any).userDepartmentId = (user as any).departmentId ?? null;
  };
}
