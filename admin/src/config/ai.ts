/* ---------------------------------------------------------------------------
   THE AI CONFIG FILE.

   Everything provider-specific is in this file and in src/ai/providers/*.
   Migrating from OpenRouter to Claude in production is one line:

       AI_PROVIDER=openrouter   ->   AI_PROVIDER=anthropic

   No task code changes, because tasks never name a provider or a model — they
   describe what they want back as a Zod schema and let the adapter satisfy it.

   The seam that makes this work is structured output. Both providers can be
   asked to return JSON matching a schema, but they spell it differently:
   Anthropic takes `output_config.format` via zodOutputFormat, OpenRouter takes
   an OpenAI-style `response_format.json_schema`. The adapters absorb that
   difference so the tasks never see it.
   --------------------------------------------------------------------------- */

import { env } from './env.js';

export type ProviderId = 'openrouter' | 'anthropic' | 'none';

export interface AiConfig {
  provider: ProviderId;
  model: string;
  apiKey: string;
  /** Hard ceiling per request. SEO metadata is small; this is a runaway guard. */
  maxOutputTokens: number;
  /** Per-user calls per hour. */
  rateLimitPerHour: number;
  /** Whole-install monthly call cap; 0 disables the cap. */
  monthlyCallCap: number;
}

export const aiConfig: AiConfig = {
  provider: env.AI_PROVIDER,
  model: env.AI_PROVIDER === 'anthropic' ? env.ANTHROPIC_MODEL : env.OPENROUTER_MODEL,
  apiKey: env.AI_PROVIDER === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENROUTER_API_KEY,
  maxOutputTokens: 1024,
  rateLimitPerHour: 60,
  monthlyCallCap: 0,
};

/* Free OpenRouter models that support structured outputs, verified against the
   live model list. If one is retired, swap OPENROUTER_MODEL to another here —
   models without structured-output support will fail schema validation. */
export const OPENROUTER_FREE_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'minimax/minimax-m3:free',
  'z-ai/glm-5.2:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
] as const;

export function assertAiConfigured(): void {
  if (aiConfig.provider === 'none') {
    throw new Error('AI is disabled. Set AI_PROVIDER in .env to enable suggestions.');
  }
  if (!aiConfig.apiKey) {
    const key = aiConfig.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENROUTER_API_KEY';
    throw new Error(`AI_PROVIDER is "${aiConfig.provider}" but ${key} is empty.`);
  }
}
