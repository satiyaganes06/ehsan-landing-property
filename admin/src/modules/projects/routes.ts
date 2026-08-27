import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission, requireAuth } from '../../lib/rbac.js';
import { requireOwnership } from '../../lib/ownership.js';
import { recordAudit, recordRevision } from '../../lib/audit.js';
import { recomputeSeo } from '../../lib/recompute-seo.js';
import { rebuildProjectsJson } from '../../lib/bridge.js';
import { uniqueSlug } from '../../lib/slug.js';
import { clientIp } from '../../lib/http.js';
import { IdParamSchema, LocaleSchema, PaginationSchema } from '../../lib/validation.js';

const ProjectStatusSchema = z.enum(['COMPLETED', 'ONGOING', 'FUTURE']);

const CreateProjectBody = z.object({
  reference: z.string().min(1),
  status: ProjectStatusSchema,
  name: z.string().min(1),
  location: z.string().min(1),
  description: z.string().default(''),
});

const UpdateProjectBody = z.object({
  status: ProjectStatusSchema.optional(),
  yearStart: z.string().nullable().optional(),
  yearEnd: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  units: z.string().nullable().optional(),
  areaText: z.string().nullable().optional(),
  priceRange: z.string().nullable().optional(),
  occupancy: z.string().nullable().optional(),
  gdvMillions: z.number().nullable().optional(),
  barWeight: z.number().min(0).max(1).nullable().optional(),
  relatedReferences: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

const TranslationBody = z.object({
  slug: z.string().min(1).optional(), // auto-generated from name if omitted
  name: z.string().min(1),
  location: z.string().min(1),
  description: z.string(),
  amenities: z.array(z.string()).default([]),
  certificate: z.string().nullable().optional(),
});

const MediaLinkBody = z.object({
  mediaId: z.string().min(1),
  role: z.enum(['hero', 'gallery', 'blueprint']).default('gallery'),
  sortOrder: z.number().int().default(0),
});

async function projectBodyForScoring(projectId: string, locale: 'EN' | 'MS') {
  const t = await prisma.projectTranslation.findUnique({ where: { projectId_locale: { projectId, locale } } });
  const media = await prisma.projectMedia.findMany({ where: { projectId }, include: { media: true } });
  return {
    bodyText: t?.description ?? '',
    imageCount: media.length,
    imagesWithAlt: media.filter((m) => Boolean(m.media.altText)).length,
  };
}

export async function projectRoutes(app: FastifyInstance) {
  app.get('/api/projects', { preHandler: requirePermission('project', 'read') }, async (req) => {
    const q = req.query as Record<string, string>;
    const { page, perPage } = PaginationSchema.parse(q);
    const where: Record<string, unknown> = {};
    if (q.publishState) where.publishState = q.publishState;
    if (q.status) where.status = q.status;

    const [total, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where, orderBy: { sortOrder: 'asc' }, skip: (page - 1) * perPage, take: perPage,
        include: {
          translations: { where: { locale: 'EN' } },
        },
      }),
    ]);

    const seoRows = await prisma.seoMeta.findMany({
      where: { entityType: 'project', entityId: { in: projects.map((p) => p.id) }, locale: 'EN' },
    });
    const seoByProject = new Map(seoRows.map((s) => [s.entityId, s]));

    return {
      page, perPage, total,
      items: projects.map((p) => ({
        id: p.id, reference: p.reference, status: p.status, publishState: p.publishState,
        yearStart: p.yearStart, yearEnd: p.yearEnd, sortOrder: p.sortOrder,
        name: p.translations[0]?.name ?? '(untranslated)',
        location: p.translations[0]?.location ?? '',
        seoScore: seoByProject.get(p.id)?.score ?? 0,
        seoBand: seoByProject.get(p.id)?.band ?? 'BAD',
      })),
    };
  });

  app.get('/api/projects/:id', { preHandler: requirePermission('project', 'read') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });

    const project = await prisma.project.findUnique({
      where: { id: params.data.id },
      include: {
        translations: true,
        media: { orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }], include: { media: true } },
      },
    });
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });

    // SeoMeta is polymorphic (entityType/entityId), not a Prisma relation --
    // it cannot be an `include`. Fetched separately and merged in.
    const seoMeta = await prisma.seoMeta.findMany({ where: { entityType: 'project', entityId: project.id } });
    return { ...project, seoMeta };
  });

  app.post('/api/projects', { preHandler: requirePermission('project', 'create') }, async (req, reply) => {
    const parsed = CreateProjectBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', message: parsed.error.message });
    const { reference, status, name, location, description } = parsed.data;

    const dupe = await prisma.project.findUnique({ where: { reference } });
    if (dupe) return reply.code(409).send({ error: 'conflict', message: `Reference "${reference}" is already in use.` });

    const maxOrder = await prisma.project.aggregate({ _max: { sortOrder: true } });
    const slug = await uniqueSlug(name, async (candidate) =>
      Boolean(await prisma.projectTranslation.findUnique({ where: { locale_slug: { locale: 'EN', slug: candidate } } })),
    );

    const project = await prisma.project.create({
      data: {
        reference, status, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        createdById: req.user!.id, publishState: 'DRAFT',
        translations: { create: { locale: 'EN', slug, name, location, description, amenities: [] } },
      },
      include: { translations: true },
    });

    recordAudit({ actorId: req.user!.id, action: 'project.created', entityType: 'project', entityId: project.id, ip: clientIp(req) });
    return reply.code(201).send(project);
  });

  app.patch('/api/projects/:id', { preHandler: requirePermission('project', 'update') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const body = UpdateProjectBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request', message: body.success ? undefined : body.error.message });

    const existing = await prisma.project.findUnique({ where: { id: params.data.id } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    if (!requireOwnership(req.user!, existing.createdById, reply)) return;

    recordRevision('project', existing.id, existing, req.user!.id);
    const project = await prisma.project.update({
      where: { id: params.data.id },
      data: body.data as any,
    });

    const scoring = await projectBodyForScoring(project.id, 'EN');
    await recomputeSeo({ entityType: 'project', entityId: project.id, locale: 'EN', internalLinkCount: (project.relatedReferences as string[]).length, ...scoring });

    recordAudit({ actorId: req.user!.id, action: 'project.updated', entityType: 'project', entityId: project.id, diff: body.data, ip: clientIp(req) });
    return reply.send(project);
  });

  app.put('/api/projects/:id/translations/:locale', { preHandler: requirePermission('project', 'update') }, async (req, reply) => {
    const params = z.object({ id: z.string(), locale: LocaleSchema }).safeParse(req.params);
    const body = TranslationBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request', message: body.success ? undefined : body.error.message });

    const project = await prisma.project.findUnique({ where: { id: params.data.id } });
    if (!project) return reply.code(404).send({ error: 'not_found' });
    if (!requireOwnership(req.user!, project.createdById, reply)) return;

    const slug = body.data.slug ?? await uniqueSlug(body.data.name, async (candidate) => {
      const hit = await prisma.projectTranslation.findUnique({ where: { locale_slug: { locale: params.data.locale, slug: candidate } } });
      return Boolean(hit && hit.projectId !== project.id);
    });

    const existing = await prisma.projectTranslation.findUnique({
      where: { projectId_locale: { projectId: project.id, locale: params.data.locale } },
    });
    if (existing) recordRevision('project_translation', existing.id, existing, req.user!.id);

    const translation = await prisma.projectTranslation.upsert({
      where: { projectId_locale: { projectId: project.id, locale: params.data.locale } },
      create: { projectId: project.id, locale: params.data.locale, slug, ...body.data },
      update: { slug, ...body.data },
    });

    const scoring = await projectBodyForScoring(project.id, params.data.locale);
    await recomputeSeo({ entityType: 'project', entityId: project.id, locale: params.data.locale, internalLinkCount: (project.relatedReferences as string[]).length, ...scoring });

    recordAudit({ actorId: req.user!.id, action: 'project.translation.updated', entityType: 'project', entityId: project.id, ip: clientIp(req) });
    return reply.send(translation);
  });

  app.post('/api/projects/:id/media', { preHandler: requirePermission('project', 'update') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const body = MediaLinkBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });

    const project = await prisma.project.findUnique({ where: { id: params.data.id } });
    if (!project) return reply.code(404).send({ error: 'not_found' });
    if (!requireOwnership(req.user!, project.createdById, reply)) return;

    const link = await prisma.projectMedia.create({ data: { projectId: project.id, ...body.data } });
    return reply.code(201).send(link);
  });

  app.delete('/api/projects/:id/media/:linkId', { preHandler: requirePermission('project', 'update') }, async (req, reply) => {
    const params = z.object({ id: z.string(), linkId: z.string() }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    await prisma.projectMedia.delete({ where: { id: params.data.linkId } }).catch(() => {});
    return reply.code(204).send();
  });

  app.post('/api/projects/:id/publish', { preHandler: requirePermission('project', 'publish') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });

    const translation = await prisma.projectTranslation.findUnique({ where: { projectId_locale: { projectId: params.data.id, locale: 'EN' } } });
    if (!translation) return reply.code(400).send({ error: 'bad_request', message: 'Add English content before publishing.' });

    const project = await prisma.project.update({
      where: { id: params.data.id },
      data: { publishState: 'PUBLISHED', publishedAt: new Date() },
    });
    const { count } = await rebuildProjectsJson();

    recordAudit({ actorId: req.user!.id, action: 'project.published', entityType: 'project', entityId: project.id, ip: clientIp(req) });
    return reply.send({ ...project, sitePublishedCount: count });
  });

  app.post('/api/projects/:id/unpublish', { preHandler: requirePermission('project', 'publish') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    const project = await prisma.project.update({ where: { id: params.data.id }, data: { publishState: 'DRAFT' } });
    await rebuildProjectsJson();
    recordAudit({ actorId: req.user!.id, action: 'project.unpublished', entityType: 'project', entityId: project.id, ip: clientIp(req) });
    return reply.send(project);
  });

  app.delete('/api/projects/:id', { preHandler: requirePermission('project', 'delete') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    await prisma.project.delete({ where: { id: params.data.id } });
    await rebuildProjectsJson();
    recordAudit({ actorId: req.user!.id, action: 'project.deleted', entityType: 'project', entityId: params.data.id, ip: clientIp(req) });
    return reply.code(204).send();
  });

  app.get('/api/projects/:id/revisions', { preHandler: requirePermission('project', 'read') }, async (req) => {
    const params = IdParamSchema.parse(req.params);
    return prisma.revision.findMany({
      where: { entityType: { in: ['project', 'project_translation'] }, entityId: params.id },
      orderBy: { createdAt: 'desc' }, take: 30,
    });
  });
}
