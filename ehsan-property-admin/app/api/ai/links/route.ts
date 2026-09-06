import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { suggestInternalLinks } from '@/lib/server/ai/tasks/seo';
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

  // Everything else in the same language is a candidate to link to.
  const mapped =
    body.entityType === 'project'
      ? (
          await prisma.projectTranslation.findMany({
            where: { locale: body.locale, projectId: { not: body.entityId } },
            select: { name: true, location: true, project: { select: { reference: true } } },
            take: 30,
          })
        ).map((c) => ({ reference: c.project.reference, name: c.name, location: c.location }))
      : (
          await prisma.eventTranslation.findMany({
            where: { locale: body.locale, eventId: { not: body.entityId } },
            select: { title: true, location: true, event: { select: { reference: true } } },
            take: 30,
          })
        ).map((c) => ({ reference: c.event.reference, name: c.title, location: c.location }));

  try {
    const result = await suggestInternalLinks({
      name: content.name, body: content.body, candidates: mapped, locale: body.locale,
    });
    const row = await logSuggestion({
      task: 'links', ...body, input: { candidateCount: mapped.length }, result, createdById: user.id,
    });
    return json({ suggestionId: row.id, ...result });
  } catch (err) {
    return handleAiError(err);
  }
});
