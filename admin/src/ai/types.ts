import type { z } from 'zod';

export interface JsonRequest<TSchema extends z.ZodTypeAny> {
  /** Stable name for the output shape. Some providers require one. */
  name: string;
  system: string;
  prompt: string;
  schema: TSchema;
  maxTokens?: number;
}

export interface AiResult<T> {
  data: T;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/** The whole provider contract. Adding a provider means implementing this. */
export interface AiProvider {
  readonly id: string;
  readonly model: string;
  json<TSchema extends z.ZodTypeAny>(
    req: JsonRequest<TSchema>,
  ): Promise<AiResult<z.infer<TSchema>>>;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}
