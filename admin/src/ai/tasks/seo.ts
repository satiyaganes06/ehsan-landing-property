/* ---------------------------------------------------------------------------
   SEO suggestion tasks.

   Note what is absent: no provider name, no model id, no fetch, no SDK import.
   Each task is a Zod schema plus a prompt. That is what makes the OpenRouter →
   Claude switch a one-line env change rather than a rewrite.

   These SUGGEST. The score engine that grades a page is deterministic and
   lives elsewhere — a score that moves between runs is one nobody trusts, and
   nothing here publishes itself.
   --------------------------------------------------------------------------- */

import { z } from 'zod';
import { getAi } from '../index.js';
import type { AiResult } from '../types.js';

const VOICE = `You write for Ehsan Plant & Property Sdn Bhd, a Bumiputera property
developer and CIDB G7 contractor in Malaysia, established 2008. Sixteen projects,
RM 1.307 billion GDV, 3,442 units across Selangor, Negeri Sembilan, Melaka, Johor
and Kedah. Their motto is "We build for your needs."

Write plainly and concretely. Use specifics — unit counts, locations, years — over
adjectives. Never invent facts that are not in the supplied content. Malaysian
English spelling.`;

export type SeoLocale = 'EN' | 'MS';

function localeLine(locale: SeoLocale): string {
  return locale === 'MS'
    ? 'Write the output in Bahasa Melayu, as used in Malaysian property marketing.'
    : 'Write the output in English.';
}

/* ---------- 1. meta title + description ---------- */

export const MetaSuggestion = z.object({
  variants: z
    .array(
      z.object({
        title: z.string().describe('Meta title, 30-60 characters'),
        description: z.string().describe('Meta description, 120-158 characters'),
        rationale: z.string().describe('One sentence on why this angle works'),
      }),
    )
    .length(3),
});
export type MetaSuggestion = z.infer<typeof MetaSuggestion>;

export function suggestMeta(input: {
  kind: 'project' | 'event' | 'page';
  name: string;
  location?: string;
  body: string;
  focusKeyword?: string;
  locale: SeoLocale;
}): Promise<AiResult<MetaSuggestion>> {
  return getAi().json({
    name: 'MetaSuggestion',
    schema: MetaSuggestion,
    system: `${VOICE}\n\n${localeLine(input.locale)}`,
    prompt: [
      `Write three meta title and description pairs for this ${input.kind}.`,
      ``,
      `Name: ${input.name}`,
      input.location ? `Location: ${input.location}` : '',
      input.focusKeyword ? `Focus keyword (must appear in every title): ${input.focusKeyword}` : '',
      ``,
      `Content:`,
      input.body,
      ``,
      `Hard limits: titles 30-60 characters, descriptions 120-158 characters.`,
      `Titles need not repeat the company name — it is appended automatically.`,
      `Give each variant a different angle: one factual, one benefit-led, one location-led.`,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/* ---------- 2. focus keywords ---------- */

export const KeywordSuggestion = z.object({
  keywords: z
    .array(
      z.object({
        keyword: z.string(),
        intent: z.enum(['informational', 'commercial', 'transactional', 'navigational']),
        rationale: z.string(),
      }),
    )
    .min(3)
    .max(8),
});
export type KeywordSuggestion = z.infer<typeof KeywordSuggestion>;

export function suggestKeywords(input: {
  name: string;
  location?: string;
  body: string;
  locale: SeoLocale;
}): Promise<AiResult<KeywordSuggestion>> {
  return getAi().json({
    name: 'KeywordSuggestion',
    schema: KeywordSuggestion,
    system: `${VOICE}\n\n${localeLine(input.locale)}`,
    prompt: [
      `Suggest focus keywords a Malaysian property buyer would actually type.`,
      `Favour location-qualified phrases over generic industry terms.`,
      ``,
      `Name: ${input.name}`,
      input.location ? `Location: ${input.location}` : '',
      ``,
      `Content:`,
      input.body,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/* ---------- 3. rewrite against failing score rules ---------- */

export const RewriteSuggestion = z.object({
  title: z.string(),
  description: z.string(),
  changes: z.array(z.string()).describe('What was changed, one line per fix'),
});
export type RewriteSuggestion = z.infer<typeof RewriteSuggestion>;

export function rewriteForScore(input: {
  currentTitle: string;
  currentDescription: string;
  failingRules: string[];
  focusKeyword?: string;
  body: string;
  locale: SeoLocale;
}): Promise<AiResult<RewriteSuggestion>> {
  return getAi().json({
    name: 'RewriteSuggestion',
    schema: RewriteSuggestion,
    system: `${VOICE}\n\n${localeLine(input.locale)}`,
    prompt: [
      `Revise this metadata so it passes the listed checks. Change as little as possible.`,
      ``,
      `Current title: ${input.currentTitle}`,
      `Current description: ${input.currentDescription}`,
      input.focusKeyword ? `Focus keyword: ${input.focusKeyword}` : '',
      ``,
      `Failing checks:`,
      ...input.failingRules.map((r) => `- ${r}`),
      ``,
      `Source content:`,
      input.body,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/* ---------- 4. image alt text ---------- */

export const AltTextSuggestion = z.object({
  altText: z.string().describe('Under 125 characters, describes what is shown'),
});
export type AltTextSuggestion = z.infer<typeof AltTextSuggestion>;

export function suggestAltText(input: {
  filename: string;
  context: string;
  locale: SeoLocale;
}): Promise<AiResult<AltTextSuggestion>> {
  return getAi().json({
    name: 'AltTextSuggestion',
    schema: AltTextSuggestion,
    system: `${VOICE}\n\n${localeLine(input.locale)}`,
    prompt: [
      `Write alt text for an image used in this context.`,
      `Describe what a sighted person would see. Do not begin with "Image of" or "Photo of".`,
      `Under 125 characters.`,
      ``,
      `Filename: ${input.filename}`,
      `Used in: ${input.context}`,
    ].join('\n'),
  });
}

/* ---------- 5. internal links ---------- */

export const LinkSuggestion = z.object({
  links: z
    .array(
      z.object({
        targetReference: z.string().describe('The reference id of the record to link to'),
        anchorText: z.string(),
        reason: z.string(),
      }),
    )
    .max(5),
});
export type LinkSuggestion = z.infer<typeof LinkSuggestion>;

export function suggestInternalLinks(input: {
  name: string;
  body: string;
  candidates: Array<{ reference: string; name: string; location: string }>;
  locale: SeoLocale;
}): Promise<AiResult<LinkSuggestion>> {
  return getAi().json({
    name: 'LinkSuggestion',
    schema: LinkSuggestion,
    system: `${VOICE}\n\n${localeLine(input.locale)}`,
    prompt: [
      `Suggest internal links from this record to others. Only suggest a link where`,
      `there is a real relationship — same township, same phase, same category.`,
      `Return an empty list rather than a weak link.`,
      ``,
      `This record: ${input.name}`,
      input.body,
      ``,
      `Candidates:`,
      ...input.candidates.map((c) => `- ${c.reference}: ${c.name} (${c.location})`),
    ].join('\n'),
  });
}
