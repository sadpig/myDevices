import { FastifyPluginAsync } from 'fastify';
import { CheckinService } from './checkin.js';
import { CommandService } from './commands.js';
import { APNsService } from './apns.js';
import { EnrollmentService } from './enrollment.js';

const mdmRoutes: FastifyPluginAsync = async (fastify) => {
  const checkinService = new CheckinService(fastify.prisma);
  const apnsService = new APNsService({
    keyId: process.env.APNS_KEY_ID || '',
    teamId: process.env.APNS_TEAM_ID || '',
    keyPath: process.env.APNS_KEY_PATH || '',
    topic: process.env.APNS_TOPIC || '',
    production: process.env.NODE_ENV === 'production',
  });
  const commandService = new CommandService(fastify.prisma, apnsService);

  const enrollmentService = new EnrollmentService({
    serverUrl: process.env.MDM_SERVER_URL || `http://localhost:${process.env.PORT || '3001'}`,
    topic: process.env.APNS_TOPIC || '',
    identityName: 'myDevices MDM Certificate',
  });

  // MDM Enrollment profile download
  fastify.get('/enroll', async (_request, reply) => {
    const profileXml = enrollmentService.generateProfile();
    reply
      .header('Content-Type', 'application/x-apple-aspen-config')
      .header('Content-Disposition', 'attachment; filename="enrollment.mobileconfig"')
      .send(profileXml);
  });

  // MDM Check-in endpoint
  fastify.put('/checkin', async (request, reply) => {
    const body = request.body as any;
    const messageType = body.MessageType || body.messageType;

    switch (messageType) {
      case 'Authenticate':
        return checkinService.handleAuthenticate(
          body.UDID, body.SerialNumber || '', body.Model || '',
          body.DeviceName || '', body.OSVersion || '', body.ProductName || ''
        );
      case 'TokenUpdate':
        return checkinService.handleTokenUpdate(
          body.UDID, body.PushMagic, body.Token, body.UnlockToken
        );
      case 'CheckOut':
        return checkinService.handleCheckOut(body.UDID);
      default:
        return reply.status(400).send({ error: 'Unknown message type' });
    }
  });

  // MDM Connect endpoint - device fetches commands and reports results
  fastify.put('/connect', async (request) => {
    const body = request.body as any;
    const udid = body.UDID;

    // If device is reporting command result
    if (body.CommandUUID) {
      const statusMap: Record<string, string> = {
        'Acknowledged': 'acknowledged',
        'Error': 'error',
        'NotNow': 'not_now',
        'CommandFormatError': 'error',
      };
      const status = (statusMap[body.Status] || 'error') as import('@prisma/client').CommandStatus;
      await commandService.acknowledgeCommand(body.CommandUUID, status, body);
    }

    // Find device and get next command
    const device = await fastify.prisma.device.findUnique({ where: { udid } });
    if (!device) return {};

    await fastify.prisma.device.update({ where: { udid }, data: { lastSeenAt: new Date() } });

    const nextCommand = await commandService.getNextCommand(device.id);
    if (!nextCommand) return {};

    return {
      CommandUUID: nextCommand.requestId,
      Command: {
        RequestType: nextCommand.commandType,
        ...((nextCommand.payload as any) || {}),
      },
    };
  });
};

export default mdmRoutes;
