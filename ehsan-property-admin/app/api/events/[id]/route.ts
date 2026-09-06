import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit, recordRevision } from '@/lib/server/audit';
import { recomputeSeo } from '@/lib/server/recompute-seo';
import { scoringInputFor } from '@/lib/server/seo-input';
import { canActOnOwnRecord } from '@/lib/server/ownership';
import { clientIp, forbiddenOwnership, json, noContent, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const UpdateEventBody = z.object({
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  capacity: z.number().int().nullable().optional(),
  registered: z.number().int().optional(),
  isFree: z.boolean().optional(),
  priceText: z.string().nullable().optional(),
  heroMediaId: z.string().nullable().optional(),
  heroImageUrl: z.string().nullable().optional(),
  relatedReferences: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

export const GET = route<{ id: string }>({ resource: 'event', action: 'read' }, async ({ params }) => {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { translations: true, heroMedia: true },
  });
  if (!event) return json({ error: 'not_found', message: 'Event not found.' }, 404);

  const seoMeta = await prisma.seoMeta.findMany({
    where: { entityType: 'event', entityId: event.id },
  });
  return json({ ...event, seoMeta });
});

export const PATCH = route<{ id: string }>(
  { resource: 'event', action: 'update' },
  async ({ request, params, user }) => {
    const data = UpdateEventBody.parse(await request.json());

    const existing = await prisma.event.findUnique({ where: { id: params.id } });
    if (!existing) return json({ error: 'not_found', message: 'Event not found.' }, 404);
    if (!canActOnOwnRecord(user, existing.createdById)) return forbiddenOwnership();

    recordRevision('event', existing.id, existing, user.id);
    const event = await prisma.event.update({ where: { id: params.id }, data: data as never });

    const scoring = await scoringInputFor('event', event.id, 'EN');
    await recomputeSeo({ entityType: 'event', entityId: event.id, locale: 'EN', ...scoring });

    recordAudit({
      actorId: user.id, action: 'event.updated', entityType: 'event',
      entityId: event.id, diff: data, ip: clientIp(request),
    });
    return json(event);
  },
);

export const DELETE = route<{ id: string }>(
  { resource: 'event', action: 'delete' },
  async ({ request, params, user }) => {
    await prisma.event.delete({ where: { id: params.id } });
    recordAudit({
      actorId: user.id, action: 'event.deleted', entityType: 'event',
      entityId: params.id, ip: clientIp(request),
    });
    return noContent();
  },
);
