import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { recordAudit } from '../../lib/audit.js';
import { clientIp } from '../../lib/http.js';
import { IdParamSchema, LocaleSchema } from '../../lib/validation.js';

const AwardBody = z.object({
  reference: z.string().min(1), year: z.number().int(), mediaId: z.string().nullable().optional(), sortOrder: z.number().int().default(0),
});
const TranslationBody = z.object({ name: z.string().min(1), issuer: z.string().nullable().optional(), description: z.string() });

export async function awardRoutes(app: FastifyInstance) {
  app.get('/api/awards', { preHandler: requirePermission('award', 'read') }, async () => {
    const awards = await prisma.award.findMany({
      orderBy: { sortOrder: 'asc' }, include: { translations: { where: { locale: 'EN' } }, media: true },
    });
    return awards.map((a) => ({
      id: a.id, reference: a.reference, year: a.year, sortOrder: a.sortOrder, publishState: a.publishState,
      name: a.translations[0]?.name ?? '(untranslated)', mediaUrl: a.media ? `/media/${a.media.storageKey.replace(':', '/')}` : null,
    }));
  });

  app.get('/api/awards/:id', { preHandler: requirePermission('award', 'read') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    const award = await prisma.award.findUnique({ where: { id: params.data.id }, include: { translations: true, media: true } });
    if (!award) return reply.code(404).send({ error: 'not_found' });
    return award;
  });

  app.post('/api/awards', { preHandler: requirePermission('award', 'create') }, async (req, reply) => {
    const parsed = AwardBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', message: parsed.error.message });
    const award = await prisma.award.create({ data: { ...parsed.data, publishState: 'DRAFT' } });
    recordAudit({ actorId: req.user!.id, action: 'award.created', entityType: 'award', entityId: award.id, ip: clientIp(req) });
    return reply.code(201).send(award);
  });

  app.patch('/api/awards/:id', { preHandler: requirePermission('award', 'update') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const body = AwardBody.partial().safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });
    const award = await prisma.award.update({ where: { id: params.data.id }, data: body.data });
    recordAudit({ actorId: req.user!.id, action: 'award.updated', entityType: 'award', entityId: award.id, diff: body.data, ip: clientIp(req) });
    return reply.send(award);
  });

  app.put('/api/awards/:id/translations/:locale', { preHandler: requirePermission('award', 'update') }, async (req, reply) => {
    const params = z.object({ id: z.string(), locale: LocaleSchema }).safeParse(req.params);
    const body = TranslationBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });
    const translation = await prisma.awardTranslation.upsert({
      where: { awardId_locale: { awardId: params.data.id, locale: params.data.locale } },
      create: { awardId: params.data.id, locale: params.data.locale, ...body.data },
      update: body.data,
    });
    return reply.send(translation);
  });

  app.post('/api/awards/:id/publish', { preHandler: requirePermission('award', 'publish') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    const award = await prisma.award.update({ where: { id: params.data.id }, data: { publishState: 'PUBLISHED' } });
    recordAudit({ actorId: req.user!.id, action: 'award.published', entityType: 'award', entityId: award.id, ip: clientIp(req) });
    return reply.send(award);
  });

  app.delete('/api/awards/:id', { preHandler: requirePermission('award', 'delete') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    await prisma.award.delete({ where: { id: params.data.id } });
    recordAudit({ actorId: req.user!.id, action: 'award.deleted', entityType: 'award', entityId: params.data.id, ip: clientIp(req) });
    return reply.code(204).send();
  });
}
