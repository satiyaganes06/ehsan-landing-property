import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { recordAudit } from '../../lib/audit.js';
import { clientIp } from '../../lib/http.js';
import { LocaleSchema } from '../../lib/validation.js';
import { recomputeSeo } from '../../lib/recompute-seo.js';

const EntityTypeSchema = z.enum(['project', 'event']);

const SeoMetaBody = z.object({
  focusKeyword: z.string().nullable().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
  ogTitle: z.string().nullable().optional(),
  ogDescription: z.string().nullable().optional(),
  ogMediaId: z.string().nullable().optional(),
});

async function scoringInputFor(entityType: 'project' | 'event', entityId: string, locale: 'EN' | 'MS') {
  if (entityType === 'project') {
    const t = await prisma.projectTranslation.findUnique({ where: { projectId_locale: { projectId: entityId, locale } } });
    const media = await prisma.projectMedia.findMany({ where: { projectId: entityId }, include: { media: true } });
    const project = await prisma.project.findUnique({ where: { id: entityId } });
    return {
      bodyText: t?.description ?? '', imageCount: media.length,
      imagesWithAlt: media.filter((m) => Boolean(m.media.altText)).length,
      internalLinkCount: ((project?.relatedReferences as string[]) ?? []).length,
    };
  }
  const t = await prisma.eventTranslation.findUnique({ where: { eventId_locale: { eventId: entityId, locale } } });
  const event = await prisma.event.findUnique({ where: { id: entityId } });
  let imagesWithAlt = 0;
  if (event?.heroMediaId) {
    const media = await prisma.media.findUnique({ where: { id: event.heroMediaId } });
    if (media?.altText) imagesWithAlt = 1;
  }
  return {
    bodyText: t?.description ?? '', imageCount: event?.heroMediaId || event?.heroImageUrl ? 1 : 0,
    imagesWithAlt, internalLinkCount: ((event?.relatedReferences as string[]) ?? []).length,
  };
}

export async function seoRoutes(app: FastifyInstance) {
  app.get('/api/seo/:entityType/:entityId', { preHandler: requirePermission('project', 'read') }, async (req, reply) => {
    const params = z.object({ entityType: EntityTypeSchema, entityId: z.string() }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    const rows = await prisma.seoMeta.findMany({ where: { entityType: params.data.entityType, entityId: params.data.entityId } });
    return rows;
  });

  app.put('/api/seo/:entityType/:entityId/:locale', { preHandler: requirePermission('project', 'update') }, async (req, reply) => {
    const params = z.object({ entityType: EntityTypeSchema, entityId: z.string(), locale: LocaleSchema }).safeParse(req.params);
    const body = SeoMetaBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request', message: body.success ? undefined : body.error.message });

    await prisma.seoMeta.upsert({
      where: { entityType_entityId_locale: { entityType: params.data.entityType, entityId: params.data.entityId, locale: params.data.locale } },
      create: { entityType: params.data.entityType, entityId: params.data.entityId, locale: params.data.locale, ...body.data },
      update: body.data,
    });

    const scoring = await scoringInputFor(params.data.entityType, params.data.entityId, params.data.locale);
    await recomputeSeo({ entityType: params.data.entityType, entityId: params.data.entityId, locale: params.data.locale, ...scoring });

    const fresh = await prisma.seoMeta.findUnique({
      where: { entityType_entityId_locale: { entityType: params.data.entityType, entityId: params.data.entityId, locale: params.data.locale } },
    });

    recordAudit({ actorId: req.user!.id, action: 'seo.updated', entityType: params.data.entityType, entityId: params.data.entityId, diff: body.data, ip: clientIp(req) });
    return reply.send(fresh);
  });

  // Site-wide health report -- feeds the dashboard "needs attention" panel.
  app.get('/api/seo/report', { preHandler: requirePermission('project', 'read') }, async () => {
    const rows = await prisma.seoMeta.findMany({ where: { band: { not: 'GOOD' } }, orderBy: { score: 'asc' } });

    const enriched = await Promise.all(
      rows.map(async (r) => {
        const title =
          r.entityType === 'project'
            ? (await prisma.projectTranslation.findFirst({ where: { projectId: r.entityId, locale: r.locale } }))?.name
            : (await prisma.eventTranslation.findFirst({ where: { eventId: r.entityId, locale: r.locale } }))?.title;
        return { entityType: r.entityType, entityId: r.entityId, locale: r.locale, title: title ?? '(untitled)', score: r.score, band: r.band };
      }),
    );

    const counts = await prisma.seoMeta.groupBy({ by: ['band'], _count: true });
    return {
      counts: Object.fromEntries(counts.map((c) => [c.band, c._count])),
      items: enriched,
    };
  });
}
