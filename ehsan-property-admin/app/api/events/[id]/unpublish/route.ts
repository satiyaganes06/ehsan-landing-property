import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { rebuildEventsJson } from '@/lib/server/bridge';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const POST = route<{ id: string }>(
  { resource: 'event', action: 'publish' },
  async ({ request, params, user }) => {
    const event = await prisma.event.update({
      where: { id: params.id },
      data: { publishState: 'DRAFT' },
    });
    await rebuildEventsJson();
    recordAudit({
      actorId: user.id, action: 'event.unpublished', entityType: 'event',
      entityId: event.id, ip: clientIp(request),
    });
    return json(event);
  },
);
