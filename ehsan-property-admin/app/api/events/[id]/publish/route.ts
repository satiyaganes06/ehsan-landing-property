import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { rebuildEventsJson } from '@/lib/server/bridge';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const POST = route<{ id: string }>(
  { resource: 'event', action: 'publish' },
  async ({ request, params, user }) => {
    const translation = await prisma.eventTranslation.findUnique({
      where: { eventId_locale: { eventId: params.id, locale: 'EN' } },
    });
    if (!translation) {
      return json({ error: 'bad_request', message: 'Add English content before publishing.' }, 400);
    }

    const event = await prisma.event.update({
      where: { id: params.id },
      data: { publishState: 'PUBLISHED', publishedAt: new Date() },
    });
    const { count } = await rebuildEventsJson();

    recordAudit({
      actorId: user.id, action: 'event.published', entityType: 'event',
      entityId: event.id, ip: clientIp(request),
    });
    return json({ ...event, sitePublishedCount: count });
  },
);
