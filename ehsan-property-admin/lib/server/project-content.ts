import 'server-only';
import { z } from 'zod';
import { prisma } from './prisma';

const text = z.string().trim().max(3000);
export const projectContentSchema = z.object({
  template: z.literal('widuri-sections-v1').default('widuri-sections-v1'),
  sourceOnly: z.boolean().default(false),
  facts: z.array(z.tuple([text, text])).max(30).default([]),
  access: z.array(text).max(50).default([]),
  neighbourhood: z.array(z.object({ title: text, items: z.array(text).max(50) })).max(20).default([]),
  layouts: z.array(z.object({ name: text, details: z.array(text).max(20) })).max(30).default([]),
  facilities: z.array(text).max(100).default([]),
  updates: z.array(text).max(20).default([]),
  locationText: text.default(''),
  shuttle: z.array(text).max(30).default([]),
  fit: z.array(text).max(30).default([]),
});
export type ProjectContent = z.infer<typeof projectContentSchema>;
export const projectContentKey = (reference: string) => `project.content.${reference}`;
export async function readProjectContent(reference: string) {
  if (reference === 'proj-15') return null; // Never replace Widuri's bespoke content.
  const row = await prisma.textBlock.findUnique({ where: { key: projectContentKey(reference) }, include: { translations: { where: { locale: 'EN' } } } });
  return row ? projectContentSchema.parse(row.translations[0]?.value ?? {}) : null;
}
