import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { clientIp } from '../../lib/http.js';
import { LocaleSchema } from '../../lib/validation.js';
import { checkAiRateLimit, AiRateLimitError } from '../../lib/ai-rate-limit.js';
import { aiConfig } from '../../config/ai.js';
import { isAiEnabled } from '../../ai/index.js';
import { AiError } from '../../ai/types.js';
import {
  suggestMeta, suggestKeywords, rewriteForScore, suggestAltText, suggestInternalLinks,
} from '../../ai/tasks/seo.js';

const EntityRef = z.object({ entityType: z.enum(['project', 'event']), entityId: z.string(), locale: LocaleSchema });

async function entityContent(entityType: 'project' | 'event', entityId: string, locale: 'EN' | 'MS') {
  if (entityType === 'project') {
    const p = await prisma.project.findUnique({ where: { id: entityId } });
    const t = await prisma.projectTranslation.findUnique({ where: { projectId_locale: { projectId: entityId, locale } } });
    if (!p || !t) return null;
    return { name: t.name, location: t.location, body: t.description, reference: p.reference };
  }
  const e = await prisma.event.findUnique({ where: { id: entityId } });
  const t = await prisma.eventTranslation.findUnique({ where: { eventId_locale: { eventId: entityId, locale } } });
  if (!e || !t) return null;
  return { name: t.title, location: t.location, body: t.description, reference: e.reference };
}

function logSuggestion(input: {
  task: string; entityType?: string; entityId?: string; locale?: 'EN' | 'MS';
  input: unknown; result: { data: unknown; provider: string; model: string; inputTokens: number; outputTokens: number; latencyMs: number };
  createdById: string;
}) {
  return prisma.aiSuggestion.create({
    data: {
      task: input.task, provider: input.result.provider, model: input.result.model,
      entityType: input.entityType, entityId: input.entityId, locale: input.locale,
      input: input.input as any, output: input.result.data as any,
      inputTokens: input.result.inputTokens, outputTokens: input.result.outputTokens,
      latencyMs: input.result.latencyMs, createdById: input.createdById,
    },
  });
}

export async function aiRoutes(app: FastifyInstance) {
  app.get('/api/ai/status', { preHandler: requirePermission('ai', 'use') }, async () => ({
    enabled: isAiEnabled(), provider: aiConfig.provider, model: aiConfig.model,
  }));

  app.addHook('preHandler', async (req, reply) => {
    if (!req.routeOptions.url?.startsWith('/api/ai/') || req.routeOptions.url === '/api/ai/status') return;
    if (!req.user) return; // requirePermission on each route already sends 401
    try {
      await checkAiRateLimit(req.user.id);
    } catch (err) {
      if (err instanceof AiRateLimitError) {
        reply.code(429).send({ error: 'rate_limited', message: err.message });
      }
    }
  });

  app.post('/api/ai/meta', { preHandler: requirePermission('ai', 'use') }, async (req, reply) => {
    if (reply.sent) return;
    const body = EntityRef.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const content = await entityContent(body.data.entityType, body.data.entityId, body.data.locale);
    if (!content) return reply.code(404).send({ error: 'not_found', message: 'Add content in this language before generating metadata.' });

    const seo = await prisma.seoMeta.findUnique({
      where: { entityType_entityId_locale: { entityType: body.data.entityType, entityId: body.data.entityId, locale: body.data.locale } },
    });

    try {
      const result = await suggestMeta({
        kind: body.data.entityType, name: content.name, location: content.location,
        body: content.body, focusKeyword: seo?.focusKeyword ?? undefined, locale: body.data.locale,
      });
      const row = await logSuggestion({ task: 'meta', ...body.data, input: content, result, createdById: req.user!.id });
      return reply.send({ suggestionId: row.id, ...result });
    } catch (err) {
      return handleAiError(err, reply);
    }
  });

  app.post('/api/ai/keywords', { preHandler: requirePermission('ai', 'use') }, async (req, reply) => {
    if (reply.sent) return;
    const body = EntityRef.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const content = await entityContent(body.data.entityType, body.data.entityId, body.data.locale);
    if (!content) return reply.code(404).send({ error: 'not_found' });

    try {
      const result = await suggestKeywords({ name: content.name, location: content.location, body: content.body, locale: body.data.locale });
      const row = await logSuggestion({ task: 'keywords', ...body.data, input: content, result, createdById: req.user!.id });
      return reply.send({ suggestionId: row.id, ...result });
    } catch (err) {
      return handleAiError(err, reply);
    }
  });

  app.post('/api/ai/rewrite', { preHandler: requirePermission('ai', 'use') }, async (req, reply) => {
    if (reply.sent) return;
    const body = EntityRef.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const content = await entityContent(body.data.entityType, body.data.entityId, body.data.locale);
    const seo = await prisma.seoMeta.findUnique({
      where: { entityType_entityId_locale: { entityType: body.data.entityType, entityId: body.data.entityId, locale: body.data.locale } },
    });
    if (!content || !seo) return reply.code(404).send({ error: 'not_found', message: 'Save meta title and description first.' });

    const failingRules = ((seo.scoreDetail as any[]) ?? []).filter((r) => !r.passed).map((r) => r.label as string);
    if (failingRules.length === 0) return reply.code(400).send({ error: 'bad_request', message: 'This record already passes every SEO rule.' });

    try {
      const result = await rewriteForScore({
        currentTitle: seo.metaTitle ?? '', currentDescription: seo.metaDescription ?? '',
        failingRules, focusKeyword: seo.focusKeyword ?? undefined, body: content.body, locale: body.data.locale,
      });
      const row = await logSuggestion({ task: 'rewrite', ...body.data, input: { failingRules }, result, createdById: req.user!.id });
      return reply.send({ suggestionId: row.id, ...result });
    } catch (err) {
      return handleAiError(err, reply);
    }
  });

  app.post('/api/ai/alt', { preHandler: requirePermission('ai', 'use') }, async (req, reply) => {
    if (reply.sent) return;
    const body = z.object({ mediaId: z.string(), context: z.string(), locale: LocaleSchema }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const media = await prisma.media.findUnique({ where: { id: body.data.mediaId } });
    if (!media) return reply.code(404).send({ error: 'not_found' });

    try {
      const result = await suggestAltText({ filename: media.filename, context: body.data.context, locale: body.data.locale });
      const row = await logSuggestion({ task: 'alt', entityType: 'media', entityId: media.id, locale: body.data.locale, input: body.data, result, createdById: req.user!.id });
      return reply.send({ suggestionId: row.id, ...result });
    } catch (err) {
      return handleAiError(err, reply);
    }
  });

  app.post('/api/ai/links', { preHandler: requirePermission('ai', 'use') }, async (req, reply) => {
    if (reply.sent) return;
    const body = EntityRef.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const content = await entityContent(body.data.entityType, body.data.entityId, body.data.locale);
    if (!content) return reply.code(404).send({ error: 'not_found' });

    const candidates =
      body.data.entityType === 'project'
        ? await prisma.projectTranslation.findMany({
            where: { locale: body.data.locale, projectId: { not: body.data.entityId } },
            select: { name: true, location: true, project: { select: { reference: true } } },
            take: 30,
          })
        : await prisma.eventTranslation.findMany({
            where: { locale: body.data.locale, eventId: { not: body.data.entityId } },
            select: { title: true, location: true, event: { select: { reference: true } } },
            take: 30,
          });

    const mapped = candidates.map((c: any) => ({
      reference: c.project?.reference ?? c.event?.reference, name: c.name ?? c.title, location: c.location,
    }));

    try {
      const result = await suggestInternalLinks({ name: content.name, body: content.body, candidates: mapped, locale: body.data.locale });
      const row = await logSuggestion({ task: 'links', ...body.data, input: { candidateCount: mapped.length }, result, createdById: req.user!.id });
      return reply.send({ suggestionId: row.id, ...result });
    } catch (err) {
      return handleAiError(err, reply);
    }
  });

  app.patch('/api/ai/suggestions/:id', { preHandler: requirePermission('ai', 'use') }, async (req, reply) => {
    const params = z.object({ id: z.string() }).safeParse(req.params);
    const body = z.object({ accepted: z.boolean() }).safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });
    const row = await prisma.aiSuggestion.update({ where: { id: params.data.id }, data: { accepted: body.data.accepted } });
    return reply.send(row);
  });
}

function handleAiError(err: unknown, reply: any) {
  if (err instanceof AiError) {
    reply.code(502).send({ error: 'ai_provider_error', message: err.message, provider: err.provider });
    return;
  }
  reply.code(500).send({ error: 'internal_error', message: 'AI request failed.' });
}
