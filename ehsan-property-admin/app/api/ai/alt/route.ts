import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { suggestAltText } from '@/lib/server/ai/tasks/seo';
import { guardAiRateLimit, handleAiError, logSuggestion } from '@/lib/server/ai/context';
import { json, route } from '@/lib/server/route';
import { LocaleSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

const Body = z.object({ mediaId: z.string(), context: z.string(), locale: LocaleSchema });

export const POST = route({ resource: 'ai', action: 'use' }, async ({ request, user }) => {
  const limited = await guardAiRateLimit(user.id);
  if (limited) return limited;

  const body = Body.parse(await request.json());
  const media = await prisma.media.findUnique({ where: { id: body.mediaId } });
  if (!media) return json({ error: 'not_found', message: 'Image not found.' }, 404);

  try {
    const result = await suggestAltText({
      filename: media.filename, context: body.context, locale: body.locale,
    });
    const row = await logSuggestion({
      task: 'alt', entityType: 'media', entityId: media.id, locale: body.locale,
      input: body, result, createdById: user.id,
    });
    return json({ suggestionId: row.id, ...result });
  } catch (err) {
    return handleAiError(err);
  }
});
