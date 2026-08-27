import { aiConfig, assertAiConfigured } from '../config/ai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenRouterProvider } from './providers/openrouter.js';
import type { AiProvider } from './types.js';

let cached: AiProvider | null = null;

/** The only place a provider is chosen. Tasks call getAi(), never a constructor. */
export function getAi(): AiProvider {
  if (cached) return cached;
  assertAiConfigured();

  cached =
    aiConfig.provider === 'anthropic'
      ? new AnthropicProvider(aiConfig.model, aiConfig.apiKey)
      : new OpenRouterProvider(aiConfig.model, aiConfig.apiKey);

  return cached;
}

export function isAiEnabled(): boolean {
  return aiConfig.provider !== 'none' && Boolean(aiConfig.apiKey);
}

/** Test seam — lets a fake provider be injected without touching env. */
export function setAiProvider(provider: AiProvider | null): void {
  cached = provider;
}

export * from './types.js';
