import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { requireOwnership } from '../../lib/ownership.js';
import { recordAudit, recordRevision } from '../../lib/audit.js';
import { recomputeSeo } from '../../lib/recompute-seo.js';
import { rebuildEventsJson } from '../../lib/bridge.js';
import { uniqueSlug } from '../../lib/slug.js';
import { clientIp } from '../../lib/http.js';
import { IdParamSchema, LocaleSchema, PaginationSchema } from '../../lib/validation.js';

const AgendaItem = z.object({ time: z.string(), title: z.string(), description: z.string() });
const Speaker = z.object({ name: z.string(), title: z.string(), image: z.string().optional(), bio: z.string().optional() });

const CreateEventBody = z.object({
  reference: z.string().min(1),
  startsAt: z.coerce.date(),
  title: z.string().min(1),
  category: z.string().min(1),
  location: z.string().min(1),
  description: z.string().default(''),
});

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

const TranslationBody = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1),
  category: z.string().min(1),
  location: z.string().min(1),
  description: z.string(),
  agenda: z.array(AgendaItem).default([]),
  speakers: z.array(Speaker).default([]),
  highlights: z.array(z.string()).default([]),
});

async function eventBodyForScoring(eventId: string, locale: 'EN' | 'MS') {
  const t = await prisma.eventTranslation.findUnique({ where: { eventId_locale: { eventId, locale } } });
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  const hasImage = Boolean(event?.heroMediaId || event?.heroImageUrl);
  let imagesWithAlt = 0;
  if (event?.heroMediaId) {
    const media = await prisma.media.findUnique({ where: { id: event.heroMediaId } });
    if (media?.altText) imagesWithAlt = 1;
  }
  return { bodyText: t?.description ?? '', imageCount: hasImage ? 1 : 0, imagesWithAlt };
}

export async function eventRoutes(app: FastifyInstance) {
  app.get('/api/events', { preHandler: requirePermission('event', 'read') }, async (req) => {
    const q = req.query as Record<string, string>;
    const { page, perPage } = PaginationSchema.parse(q);
    const where: Record<string, unknown> = {};
    if (q.publishState) where.publishState = q.publishState;

    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where, orderBy: { startsAt: 'asc' }, skip: (page - 1) * perPage, take: perPage,
        include: { translations: { where: { locale: 'EN' } } },
      }),
    ]);

    const seoRows = await prisma.seoMeta.findMany({
      where: { entityType: 'event', entityId: { in: events.map((e) => e.id) }, locale: 'EN' },
    });
    const seoByEvent = new Map(seoRows.map((s) => [s.entityId, s]));

    return {
      page, perPage, total,
      items: events.map((e) => ({
        id: e.id, reference: e.reference, startsAt: e.startsAt, publishState: e.publishState,
        capacity: e.capacity, registered: e.registered,
        title: e.translations[0]?.title ?? '(untranslated)',
        category: e.translations[0]?.category ?? '',
        seoScore: seoByEvent.get(e.id)?.score ?? 0,
        seoBand: seoByEvent.get(e.id)?.band ?? 'BAD',
      })),
    };
  });

  app.get('/api/events/:id', { preHandler: requirePermission('event', 'read') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });

    const event = await prisma.event.findUnique({
      where: { id: params.data.id },
      include: { translations: true, heroMedia: true },
    });
    if (!event) return reply.code(404).send({ error: 'not_found', message: 'Event not found.' });

    const seoMeta = await prisma.seoMeta.findMany({ where: { entityType: 'event', entityId: event.id } });
    return { ...event, seoMeta };
  });

  app.post('/api/events', { preHandler: requirePermission('event', 'create') }, async (req, reply) => {
    const parsed = CreateEventBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', message: parsed.error.message });
    const { reference, startsAt, title, category, location, description } = parsed.data;

    const dupe = await prisma.event.findUnique({ where: { reference } });
    if (dupe) return reply.code(409).send({ error: 'conflict', message: `Reference "${reference}" is already in use.` });

    const maxOrder = await prisma.event.aggregate({ _max: { sortOrder: true } });
    const slug = await uniqueSlug(title, async (candidate) =>
      Boolean(await prisma.eventTranslation.findUnique({ where: { locale_slug: { locale: 'EN', slug: candidate } } })),
    );

    const event = await prisma.event.create({
      data: {
        reference, startsAt, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        createdById: req.user!.id, publishState: 'DRAFT',
        translations: { create: { locale: 'EN', slug, title, category, location, description, agenda: [], speakers: [], highlights: [] } },
      },
      include: { translations: true },
    });

    recordAudit({ actorId: req.user!.id, action: 'event.created', entityType: 'event', entityId: event.id, ip: clientIp(req) });
    return reply.code(201).send(event);
  });

  app.patch('/api/events/:id', { preHandler: requirePermission('event', 'update') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const body = UpdateEventBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request', message: body.success ? undefined : body.error.message });

    const existing = await prisma.event.findUnique({ where: { id: params.data.id } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    if (!requireOwnership(req.user!, existing.createdById, reply)) return;

    recordRevision('event', existing.id, existing, req.user!.id);
    const event = await prisma.event.update({ where: { id: params.data.id }, data: body.data as any });

    const scoring = await eventBodyForScoring(event.id, 'EN');
    await recomputeSeo({ entityType: 'event', entityId: event.id, locale: 'EN', internalLinkCount: (event.relatedReferences as string[]).length, ...scoring });

    recordAudit({ actorId: req.user!.id, action: 'event.updated', entityType: 'event', entityId: event.id, diff: body.data, ip: clientIp(req) });
    return reply.send(event);
  });

  app.put('/api/events/:id/translations/:locale', { preHandler: requirePermission('event', 'update') }, async (req, reply) => {
    const params = z.object({ id: z.string(), locale: LocaleSchema }).safeParse(req.params);
    const body = TranslationBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request', message: body.success ? undefined : body.error.message });

    const event = await prisma.event.findUnique({ where: { id: params.data.id } });
    if (!event) return reply.code(404).send({ error: 'not_found' });
    if (!requireOwnership(req.user!, event.createdById, reply)) return;

    const slug = body.data.slug ?? await uniqueSlug(body.data.title, async (candidate) => {
      const hit = await prisma.eventTranslation.findUnique({ where: { locale_slug: { locale: params.data.locale, slug: candidate } } });
      return Boolean(hit && hit.eventId !== event.id);
    });

    const existing = await prisma.eventTranslation.findUnique({ where: { eventId_locale: { eventId: event.id, locale: params.data.locale } } });
    if (existing) recordRevision('event_translation', existing.id, existing, req.user!.id);

    const translation = await prisma.eventTranslation.upsert({
      where: { eventId_locale: { eventId: event.id, locale: params.data.locale } },
      create: { eventId: event.id, locale: params.data.locale, slug, ...body.data },
      update: { slug, ...body.data },
    });

    const scoring = await eventBodyForScoring(event.id, params.data.locale);
    await recomputeSeo({ entityType: 'event', entityId: event.id, locale: params.data.locale, internalLinkCount: (event.relatedReferences as string[]).length, ...scoring });

    recordAudit({ actorId: req.user!.id, action: 'event.translation.updated', entityType: 'event', entityId: event.id, ip: clientIp(req) });
    return reply.send(translation);
  });

  app.post('/api/events/:id/publish', { preHandler: requirePermission('event', 'publish') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });

    const translation = await prisma.eventTranslation.findUnique({ where: { eventId_locale: { eventId: params.data.id, locale: 'EN' } } });
    if (!translation) return reply.code(400).send({ error: 'bad_request', message: 'Add English content before publishing.' });

    const event = await prisma.event.update({ where: { id: params.data.id }, data: { publishState: 'PUBLISHED', publishedAt: new Date() } });
    const { count } = await rebuildEventsJson();

    recordAudit({ actorId: req.user!.id, action: 'event.published', entityType: 'event', entityId: event.id, ip: clientIp(req) });
    return reply.send({ ...event, sitePublishedCount: count });
  });

  app.post('/api/events/:id/unpublish', { preHandler: requirePermission('event', 'publish') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    const event = await prisma.event.update({ where: { id: params.data.id }, data: { publishState: 'DRAFT' } });
    await rebuildEventsJson();
    recordAudit({ actorId: req.user!.id, action: 'event.unpublished', entityType: 'event', entityId: event.id, ip: clientIp(req) });
    return reply.send(event);
  });

  app.delete('/api/events/:id', { preHandler: requirePermission('event', 'delete') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    await prisma.event.delete({ where: { id: params.data.id } });
    await rebuildEventsJson();
    recordAudit({ actorId: req.user!.id, action: 'event.deleted', entityType: 'event', entityId: params.data.id, ip: clientIp(req) });
    return reply.code(204).send();
  });

  app.get('/api/events/:id/revisions', { preHandler: requirePermission('event', 'read') }, async (req) => {
    const params = IdParamSchema.parse(req.params);
    return prisma.revision.findMany({
      where: { entityType: { in: ['event', 'event_translation'] }, entityId: params.id },
      orderBy: { createdAt: 'desc' }, take: 30,
    });
  });
}
