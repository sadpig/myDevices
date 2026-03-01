import { FastifyPluginAsync } from 'fastify';
import { AssetStatus, Prisma } from '@prisma/client';
import { requirePermission } from '../../middleware/authenticate.js';
import { AuditService } from '../audit/service.js';
import { NotificationService } from '../../services/notification.js';
import { emailTemplates } from '../../services/email-templates.js';

const batchRoutes: FastifyPluginAsync = async (fastify) => {
  const auditService = new AuditService(fastify.prisma);

  // POST /batch-assign — bulk assign assets to a user/department
  fastify.post('/batch-assign', { preHandler: [requirePermission('asset:write')] }, async (request, reply) => {
    const { assetIds, assignedToId, departmentId } = request.body as {
      assetIds: string[]; assignedToId?: string; departmentId?: string;
    };
    if (!assetIds?.length) return reply.status(400).send({ error: 'assetIds required', code: 400 });

    const updateData: Record<string, unknown> = {};
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;

    const results = await fastify.prisma.$transaction(
      assetIds.map(id => fastify.prisma.asset.update({ where: { id }, data: updateData }))
    );

    const user = request.user as { id: string };
    await auditService.log(user.id, 'asset.batch_assign', 'asset', '', { assetIds, assignedToId, departmentId } as unknown as Prisma.InputJsonValue, request.ip);

    // Notify assigned user
    if (assignedToId) {
      try {
        const assignee = await fastify.prisma.user.findUnique({ where: { id: assignedToId }, select: { name: true } });
        const notifService = new NotificationService(fastify.prisma);
        const tmpl = emailTemplates.assetAssigned({
          userName: assignee?.name || '',
          deviceName: `${results.length} asset(s)`,
          serialNumber: '',
        });
        await notifService.createAndEmail(assignedToId, tmpl.subject, tmpl.html, 'asset_assigned');
      } catch { /* non-critical */ }
    }

    return { updated: results.length };
  });

  // POST /batch-status — bulk status change
  fastify.post('/batch-status', { preHandler: [requirePermission('asset:write')] }, async (request, reply) => {
    const { assetIds, status } = request.body as { assetIds: string[]; status: string };
    if (!assetIds?.length || !status) return reply.status(400).send({ error: 'assetIds and status required', code: 400 });

    const validStatuses: AssetStatus[] = ['in_use', 'in_stock', 'repairing', 'retired', 'lost'];
    if (!validStatuses.includes(status as AssetStatus)) {
      return reply.status(400).send({ error: 'Invalid status', code: 400 });
    }

    const results = await fastify.prisma.$transaction(
      assetIds.map(id => fastify.prisma.asset.update({ where: { id }, data: { status: status as AssetStatus } }))
    );

    const user = request.user as { id: string };
    await auditService.log(user.id, 'asset.batch_status', 'asset', '', { assetIds, status } as unknown as Prisma.InputJsonValue, request.ip);

    return { updated: results.length };
  });

  // POST /import — CSV import (frontend parses CSV, sends JSON array)
  fastify.post('/import', { preHandler: [requirePermission('asset:write')] }, async (request, reply) => {
    const { records } = request.body as { records: Array<{ deviceId: string; status?: string; location?: string; notes?: string; purchasePrice?: number }> };
    if (!records?.length) return reply.status(400).send({ error: 'records required', code: 400 });

    let created = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec.deviceId) {
        errors.push({ index: i, error: 'deviceId required' });
        continue;
      }
      try {
        await fastify.prisma.asset.create({
          data: {
            deviceId: rec.deviceId,
            status: (rec.status as AssetStatus) || 'in_stock',
            location: rec.location,
            notes: rec.notes,
            purchasePrice: rec.purchasePrice,
          },
        });
        created++;
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        errors.push({ index: i, error: e.code === 'P2002' ? 'Duplicate device' : (e.message || 'Unknown error') });
      }
    }

    const user = request.user as { id: string };
    await auditService.log(user.id, 'asset.import', 'asset', '', { total: records.length, created, errors: errors.length } as unknown as Prisma.InputJsonValue, request.ip);

    return { created, errors };
  });
};

export default batchRoutes;
