import { prisma } from './prisma';
import { aiConfig } from './ai-config';

export class AiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiRateLimitError';
  }
}

/** Guards against a runaway loop, not against normal editing volume -- see
    the cost note in the build plan: metadata generation is roughly a cent a
    call, so these ceilings exist for safety, not budget. */
export async function checkAiRateLimit(userId: string): Promise<void> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourly = await prisma.aiSuggestion.count({ where: { createdById: userId, createdAt: { gte: hourAgo } } });
  if (hourly >= aiConfig.rateLimitPerHour) {
    throw new AiRateLimitError(`You have made ${hourly} AI requests in the last hour — try again shortly.`);
  }

  if (aiConfig.monthlyCallCap > 0) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthly = await prisma.aiSuggestion.count({ where: { createdAt: { gte: monthStart } } });
    if (monthly >= aiConfig.monthlyCallCap) {
      throw new AiRateLimitError('The monthly AI usage cap has been reached for this installation.');
    }
  }
}
