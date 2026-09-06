import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { rewriteForScore } from '@/lib/server/ai/tasks/seo';
import { entityContent, guardAiRateLimit, handleAiError, logSuggestion } from '@/lib/server/ai/context';
import { json, route } from '@/lib/server/route';
import { LocaleSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

const EntityRef = z.object({
  entityType: z.enum(['project', 'event']),
  entityId: z.string(),
  locale: LocaleSchema,
});

export const POST = route({ resource: 'ai', action: 'use' }, async ({ request, user }) => {
  const limited = await guardAiRateLimit(user.id);
  if (limited) return limited;

  const body = EntityRef.parse(await request.json());
  const [content, seo] = await Promise.all([
    entityContent(body.entityType, body.entityId, body.locale),
    prisma.seoMeta.findUnique({
      where: { entityType_entityId_locale: { entityType: body.entityType, entityId: body.entityId, locale: body.locale } },
    }),
  ]);
  if (!content || !seo) {
    return json({ error: 'not_found', message: 'Save meta title and description first.' }, 404);
  }

  const failingRules = ((seo.scoreDetail as { passed: boolean; label: string }[]) ?? [])
    .filter((r) => !r.passed)
    .map((r) => r.label);
  if (failingRules.length === 0) {
    return json({ error: 'bad_request', message: 'This record already passes every SEO rule.' }, 400);
  }

  try {
    const result = await rewriteForScore({
      currentTitle: seo.metaTitle ?? '', currentDescription: seo.metaDescription ?? '',
      failingRules, focusKeyword: seo.focusKeyword ?? undefined,
      body: content.body, locale: body.locale,
    });
    const row = await logSuggestion({ task: 'rewrite', ...body, input: { failingRules }, result, createdById: user.id });
    return json({ suggestionId: row.id, ...result });
  } catch (err) {
    return handleAiError(err);
  }
});
