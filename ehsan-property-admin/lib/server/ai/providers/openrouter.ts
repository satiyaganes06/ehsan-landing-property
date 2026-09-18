import { z } from 'zod';
import { AiError, type AiProvider, type AiResult, type JsonRequest } from '../types';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * OpenRouter adapter — the demo provider.
 *
 * Free models are rate-limited and occasionally wrap JSON in prose or a
 * ```json fence despite response_format, so the parse is defensive in a way
 * the Anthropic adapter does not need to be. That leniency lives HERE, not in
 * the task layer, which is the point of the split: production code does not
 * inherit workarounds for a demo provider's quirks.
 */
export class OpenRouterProvider implements AiProvider {
  readonly id = 'openrouter';

  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly referer = 'https://ehsanproperty.com',
  ) {}

  async json<TSchema extends z.ZodTypeAny>(
    req: JsonRequest<TSchema>,
  ): Promise<AiResult<z.infer<TSchema>>> {
    const started = Date.now();
    // Zod 4 converts natively. `io: 'output'` describes what we want BACK, and
    // inlining refs matters because free models vary in $ref support.
    const jsonSchema = z.toJSONSchema(req.schema, { io: 'output', target: 'draft-7' });

    const body = {
      model: this.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: 0.4,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: req.name, strict: true, schema: jsonSchema },
      },
    };

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.referer,
          'X-Title': 'Ehsan Admin',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (cause) {
      throw new AiError('OpenRouter request failed', this.id, cause);
    }

    if (!res.ok) {
      throw new AiError(`OpenRouter returned ${res.status}: ${await res.text()}`, this.id);
    }

    const payload = (await res.json()) as any;
    const content: string | undefined = payload?.choices?.[0]?.message?.content;
    if (!content) throw new AiError('OpenRouter returned no content', this.id);

    const parsed = req.schema.safeParse(extractJson(content, this.id));
    if (!parsed.success) {
      throw new AiError(
        `OpenRouter output did not match schema "${req.name}": ${parsed.error.message}`,
        this.id,
      );
    }

    return {
      data: parsed.data,
      provider: this.id,
      model: this.model,
      inputTokens: payload?.usage?.prompt_tokens ?? 0,
      outputTokens: payload?.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  }
}

/** Tolerates a bare object, a ```json fence, or an object embedded in prose. */
function extractJson(raw: string, provider: string): unknown {
  const text = raw.trim();
  const attempts = [
    text,
    text.replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''),
    text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1),
  ];
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next shape */
    }
  }
  throw new AiError('Could not parse JSON from model output', provider);
}
