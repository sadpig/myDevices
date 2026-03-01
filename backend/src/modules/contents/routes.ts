import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { ContentService } from './service.js';
import { requirePermission } from '../../middleware/authenticate.js';
import { AuditService } from '../audit/service.js';
import { resolve } from 'path';
import { mkdirSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';

const contentRoutes: FastifyPluginAsync = async (fastify) => {
  const contentService = new ContentService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);
  const uploadDir = resolve(process.cwd(), 'uploads', 'contents');
  mkdirSync(uploadDir, { recursive: true });

  fastify.get('/', { preHandler: [requirePermission('content:read')] }, async (request) => {
    const { page, limit, search, type } = request.query as { page?: string; limit?: string; search?: string; type?: string };
    return contentService.list(parseInt(page || '1'), parseInt(limit || '20'), { search, type });
  });

  fastify.get('/:id', { preHandler: [requirePermission('content:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await contentService.getById(id);
    } catch (err: unknown) {
      const e = err as { code?: string; name?: string };
      if (e.code === 'P2025' || e.name === 'NotFoundError') {
        return reply.status(404).send({ error: 'Content not found', code: 404 });
      }
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal server error', code: 500 });
    }
  });

  fastify.post('/', { preHandler: [requirePermission('content:write')] }, async (request) => {
    const parts = request.parts();
    let name = '';
    let type = 'document';
    let description = '';
    let version = '';
    let fileUrl = '';
    let fileSize = 0;

    for await (const part of parts) {
      if (part.type === 'file') {
        const ext = part.filename?.split('.').pop() || 'bin';
        const filename = `${randomUUID()}.${ext}`;
        const filepath = resolve(uploadDir, filename);
        const writeStream = createWriteStream(filepath);
        await pipeline(part.file, writeStream);
        fileUrl = `/uploads/contents/${filename}`;
        fileSize = writeStream.bytesWritten;
      } else {
        const val = part.value as string;
        if (part.fieldname === 'name') name = val;
        else if (part.fieldname === 'type') type = val;
        else if (part.fieldname === 'description') description = val;
        else if (part.fieldname === 'version') version = val;
      }
    }

    const content = await contentService.create({
      name, type, fileUrl: fileUrl || undefined,
      fileSize: fileSize || undefined,
      description: description || undefined,
      version: version || undefined,
    });

    const user = request.user as { id: string };
    await auditService.log(user.id, 'content.create', 'content', content.id, { name, type } as unknown as Prisma.InputJsonValue, request.ip);
    return content;
  });

  fastify.put('/:id', { preHandler: [requirePermission('content:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as Partial<{ name: string; type: string; description: string; version: string }>;
    try {
      const content = await contentService.update(id, data);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'content.update', 'content', id, data as unknown as Prisma.InputJsonValue, request.ip);
      return content;
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2025') return reply.status(404).send({ error: 'Content not found', code: 404 });
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update content', code: 500 });
    }
  });

  fastify.delete('/:id', { preHandler: [requirePermission('content:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await contentService.remove(id);
      const user = request.user as { id: string };
      await auditService.log(user.id, 'content.delete', 'content', id, {} as Prisma.InputJsonValue, request.ip);
      return { message: 'Content removed' };
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2025') return reply.status(404).send({ error: 'Content not found', code: 404 });
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to delete content', code: 500 });
    }
  });

  fastify.post('/:id/distribute', { preHandler: [requirePermission('content:deploy')] }, async (request) => {
    const { id } = request.params as { id: string };
    const { deviceIds, departmentId } = request.body as { deviceIds?: string[]; departmentId?: string };
    const results = await contentService.distribute(id, { deviceIds, departmentId });
    const user = request.user as { id: string };
    await auditService.log(user.id, 'content.distribute', 'content', id, { deviceIds, departmentId } as unknown as Prisma.InputJsonValue, request.ip);
    return { distributed: results.length };
  });

  fastify.post('/:id/remove', { preHandler: [requirePermission('content:deploy')] }, async (request) => {
    const { id } = request.params as { id: string };
    const { deviceIds } = request.body as { deviceIds: string[] };
    await contentService.undistribute(id, deviceIds);
    const user = request.user as { id: string };
    await auditService.log(user.id, 'content.remove', 'content', id, { deviceIds } as unknown as Prisma.InputJsonValue, request.ip);
    return { message: 'Content removal initiated' };
  });
};

export default contentRoutes;
