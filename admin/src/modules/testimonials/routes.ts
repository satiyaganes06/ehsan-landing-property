import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { recordAudit } from '../../lib/audit.js';
import { clientIp } from '../../lib/http.js';
import { IdParamSchema, LocaleSchema } from '../../lib/validation.js';

const TestimonialBody = z.object({
  reference: z.string().min(1), mediaId: z.string().nullable().optional(), projectId: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0), isPlaceholder: z.boolean().default(false),
});
const TranslationBody = z.object({
  quote: z.string().min(1), author: z.string().min(1), role: z.string().min(1), groupLabel: z.string().nullable().optional(),
});

export async function testimonialRoutes(app: FastifyInstance) {
  app.get('/api/testimonials', { preHandler: requirePermission('testimonial', 'read') }, async () => {
    const items = await prisma.testimonial.findMany({
      orderBy: { sortOrder: 'asc' }, include: { translations: { where: { locale: 'EN' } } },
    });
    return items.map((t) => ({
      id: t.id, reference: t.reference, sortOrder: t.sortOrder, isPlaceholder: t.isPlaceholder, publishState: t.publishState,
      author: t.translations[0]?.author ?? '(untranslated)', quote: t.translations[0]?.quote ?? '',
    }));
  });

  app.get('/api/testimonials/:id', { preHandler: requirePermission('testimonial', 'read') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    const t = await prisma.testimonial.findUnique({ where: { id: params.data.id }, include: { translations: true, media: true } });
    if (!t) return reply.code(404).send({ error: 'not_found' });
    return t;
  });

  app.post('/api/testimonials', { preHandler: requirePermission('testimonial', 'create') }, async (req, reply) => {
    const parsed = TestimonialBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', message: parsed.error.message });
    const t = await prisma.testimonial.create({ data: { ...parsed.data, publishState: 'DRAFT' } });
    recordAudit({ actorId: req.user!.id, action: 'testimonial.created', entityType: 'testimonial', entityId: t.id, ip: clientIp(req) });
    return reply.code(201).send(t);
  });

  app.patch('/api/testimonials/:id', { preHandler: requirePermission('testimonial', 'update') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const body = TestimonialBody.partial().safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });
    const t = await prisma.testimonial.update({ where: { id: params.data.id }, data: body.data });
    recordAudit({ actorId: req.user!.id, action: 'testimonial.updated', entityType: 'testimonial', entityId: t.id, diff: body.data, ip: clientIp(req) });
    return reply.send(t);
  });

  app.put('/api/testimonials/:id/translations/:locale', { preHandler: requirePermission('testimonial', 'update') }, async (req, reply) => {
    const params = z.object({ id: z.string(), locale: LocaleSchema }).safeParse(req.params);
    const body = TranslationBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });
    const translation = await prisma.testimonialTranslation.upsert({
      where: { testimonialId_locale: { testimonialId: params.data.id, locale: params.data.locale } },
      create: { testimonialId: params.data.id, locale: params.data.locale, ...body.data },
      update: body.data,
    });
    return reply.send(translation);
  });

  app.post('/api/testimonials/:id/publish', { preHandler: requirePermission('testimonial', 'publish') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    const t = await prisma.testimonial.update({ where: { id: params.data.id }, data: { publishState: 'PUBLISHED' } });
    recordAudit({ actorId: req.user!.id, action: 'testimonial.published', entityType: 'testimonial', entityId: t.id, ip: clientIp(req) });
    return reply.send(t);
  });

  app.delete('/api/testimonials/:id', { preHandler: requirePermission('testimonial', 'delete') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    await prisma.testimonial.delete({ where: { id: params.data.id } });
    recordAudit({ actorId: req.user!.id, action: 'testimonial.deleted', entityType: 'testimonial', entityId: params.data.id, ip: clientIp(req) });
    return reply.code(204).send();
  });
}
