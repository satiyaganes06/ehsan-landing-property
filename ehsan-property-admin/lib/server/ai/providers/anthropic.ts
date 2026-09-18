import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { AiError, type AiProvider, type AiResult, type JsonRequest } from '../types';

/**
 * Anthropic adapter — the production provider.
 *
 * Uses messages.parse() with output_config.format, which validates the
 * response against the Zod schema server-side. That is why no fence-stripping
 * or prose-extraction appears here: the API returns a parsed object or nothing.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    readonly model: string,
    apiKey: string,
  ) {
    this.client = apiKey ? new Anthropic({ apiKey }) : new Anthropic();
  }

  async json<TSchema extends z.ZodTypeAny>(
    req: JsonRequest<TSchema>,
  ): Promise<AiResult<z.infer<TSchema>>> {
    const started = Date.now();

    let response;
    try {
      response = await this.client.messages.parse({
        model: this.model,
        max_tokens: req.maxTokens ?? 1024,
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }],
        output_config: { format: zodOutputFormat(req.schema) },
      });
    } catch (cause) {
      throw new AiError('Anthropic request failed', this.id, cause);
    }

    // parsed_output is null when the model could not satisfy the schema.
    if (response.parsed_output == null) {
      throw new AiError(`Anthropic returned no parsable output for "${req.name}"`, this.id);
    }

    return {
      data: response.parsed_output as z.infer<TSchema>,
      provider: this.id,
      model: this.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  }
}
