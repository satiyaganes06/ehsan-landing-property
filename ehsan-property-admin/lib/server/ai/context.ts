import 'server-only';
import { prisma } from '../prisma';
import { AiError } from './index';
import { AiRateLimitError, checkAiRateLimit } from '../ai-rate-limit';
import { json } from '../route';

/**
 * The pieces every AI route repeats: the record's own copy, a suggestion log
 * row, per-user throttling, and one error shape. In Fastify the throttle was a
 * preHandler hook shared by the whole /api/ai prefix; Next has no such seam,
 * so each route calls guardAiRateLimit() instead.
 */

export async function entityContent(
  entityType: 'project' | 'event',
  entityId: string,
  locale: 'EN' | 'MS',
) {
  if (entityType === 'project') {
    const [p, t] = await Promise.all([
      prisma.project.findUnique({ where: { id: entityId } }),
      prisma.projectTranslation.findUnique({ where: { projectId_locale: { projectId: entityId, locale } } }),
    ]);
    if (!p || !t) return null;
    return { name: t.name, location: t.location, body: t.description, reference: p.reference };
  }
  const [e, t] = await Promise.all([
    prisma.event.findUnique({ where: { id: entityId } }),
    prisma.eventTranslation.findUnique({ where: { eventId_locale: { eventId: entityId, locale } } }),
  ]);
  if (!e || !t) return null;
  return { name: t.title, location: t.location, body: t.description, reference: e.reference };
}

interface AiResult {
  data: unknown; provider: string; model: string;
  inputTokens: number; outputTokens: number; latencyMs: number;
}

export function logSuggestion(input: {
  task: string; entityType?: string; entityId?: string; locale?: 'EN' | 'MS';
  input: unknown; result: AiResult; createdById: string;
}) {
  return prisma.aiSuggestion.create({
    data: {
      task: input.task, provider: input.result.provider, model: input.result.model,
      entityType: input.entityType, entityId: input.entityId, locale: input.locale,
      input: input.input as never, output: input.result.data as never,
      inputTokens: input.result.inputTokens, outputTokens: input.result.outputTokens,
      latencyMs: input.result.latencyMs, createdById: input.createdById,
    },
  });
}

/** Returns a 429 response when the caller is over their hourly allowance. */
export async function guardAiRateLimit(userId: string): Promise<Response | null> {
  try {
    await checkAiRateLimit(userId);
    return null;
  } catch (err) {
    if (err instanceof AiRateLimitError) {
      return json({ error: 'rate_limited', message: err.message }, 429);
    }
    throw err;
  }
}

export function handleAiError(err: unknown): Response {
  if (err instanceof AiError) {
    return json({ error: 'ai_provider_error', message: err.message, provider: err.provider }, 502);
  }
  console.error('[ai]', err);
  return json({ error: 'internal_error', message: 'AI request failed.' }, 500);
}
