import { aiConfig } from '@/lib/server/ai-config';
import { isAiEnabled } from '@/lib/server/ai';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const GET = route({ resource: 'ai', action: 'use' }, async () =>
  json({ enabled: isAiEnabled(), provider: aiConfig.provider, model: aiConfig.model }),
);
