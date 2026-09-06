import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { suggestMeta } from '@/lib/server/ai/tasks/seo';
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
  const content = await entityContent(body.entityType, body.entityId, body.locale);
  if (!content) {
    return json({ error: 'not_found', message: 'Add content in this language before generating metadata.' }, 404);
  }

  const seo = await prisma.seoMeta.findUnique({
    where: { entityType_entityId_locale: { entityType: body.entityType, entityId: body.entityId, locale: body.locale } },
  });

  try {
    const result = await suggestMeta({
      kind: body.entityType, name: content.name, location: content.location,
      body: content.body, focusKeyword: seo?.focusKeyword ?? undefined, locale: body.locale,
    });
    const row = await logSuggestion({ task: 'meta', ...body, input: content, result, createdById: user.id });
    return json({ suggestionId: row.id, ...result });
  } catch (err) {
    return handleAiError(err);
  }
});
