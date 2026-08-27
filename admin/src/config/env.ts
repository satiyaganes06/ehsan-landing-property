import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:5500'),
  SITE_DATA_DIR: z.string().default('../data'),

  AI_PROVIDER: z.enum(['openrouter', 'anthropic', 'none']).default('none'),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_MODEL: z.string().default('google/gemma-4-31b-it:free'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  // Fail at boot with the actual missing keys rather than at the first request
  // with a null dereference three layers down.
  throw new Error(`Invalid environment:\n${lines.join('\n')}`);
}

export const env = parsed.data;
export type Env = typeof env;
