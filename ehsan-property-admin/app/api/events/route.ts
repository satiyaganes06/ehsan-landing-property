import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { uniqueSlug } from '@/lib/server/slug';
import { clientIp, json, route } from '@/lib/server/route';
import { PaginationSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

const CreateEventBody = z.object({
  reference: z.string().min(1),
  startsAt: z.coerce.date(),
  title: z.string().min(1),
  category: z.string().min(1),
  location: z.string().min(1),
  description: z.string().default(''),
});

export const GET = route({ resource: 'event', action: 'read' }, async ({ request }) => {
  const q = Object.fromEntries(request.nextUrl.searchParams);
  const { page, perPage } = PaginationSchema.parse(q);

  const where: Record<string, unknown> = {};
  if (q.publishState) where.publishState = q.publishState;

  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where, orderBy: { startsAt: 'asc' },
      skip: (page - 1) * perPage, take: perPage,
      include: { translations: { where: { locale: 'EN' } } },
    }),
  ]);

  const seoRows = await prisma.seoMeta.findMany({
    where: { entityType: 'event', entityId: { in: events.map((e) => e.id) }, locale: 'EN' },
  });
  const seoByEvent = new Map(seoRows.map((s) => [s.entityId, s]));

  return json({
    page, perPage, total,
    items: events.map((e) => ({
      id: e.id, reference: e.reference, startsAt: e.startsAt, publishState: e.publishState,
      capacity: e.capacity, registered: e.registered,
      title: e.translations[0]?.title ?? '(untranslated)',
      category: e.translations[0]?.category ?? '',
      seoScore: seoByEvent.get(e.id)?.score ?? 0,
      seoBand: seoByEvent.get(e.id)?.band ?? 'BAD',
    })),
  });
});

export const POST = route({ resource: 'event', action: 'create' }, async ({ request, user }) => {
  const { reference, startsAt, title, category, location, description } =
    CreateEventBody.parse(await request.json());

  if (await prisma.event.findUnique({ where: { reference } })) {
    return json({ error: 'conflict', message: `Reference "${reference}" is already in use.` }, 409);
  }

  const maxOrder = await prisma.event.aggregate({ _max: { sortOrder: true } });
  const slug = await uniqueSlug(title, async (candidate) =>
    Boolean(await prisma.eventTranslation.findUnique({
      where: { locale_slug: { locale: 'EN', slug: candidate } },
    })),
  );

  const event = await prisma.event.create({
    data: {
      reference, startsAt,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      createdById: user.id, publishState: 'DRAFT',
      translations: {
        create: { locale: 'EN', slug, title, category, location, description, agenda: [], speakers: [], highlights: [] },
      },
    },
    include: { translations: true },
  });

  recordAudit({
    actorId: user.id, action: 'event.created', entityType: 'event',
    entityId: event.id, ip: clientIp(request),
  });
  return json(event, 201);
});
