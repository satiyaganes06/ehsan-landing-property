import { z } from 'zod';
import { suggestKeywords } from '@/lib/server/ai/tasks/seo';
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
  if (!content) return json({ error: 'not_found', message: 'Add content first.' }, 404);

  try {
    const result = await suggestKeywords({
      name: content.name, location: content.location, body: content.body, locale: body.locale,
    });
    const row = await logSuggestion({ task: 'keywords', ...body, input: content, result, createdById: user.id });
    return json({ suggestionId: row.id, ...result });
  } catch (err) {
    return handleAiError(err);
  }
});
