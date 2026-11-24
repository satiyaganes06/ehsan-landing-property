import { z } from 'zod';

const entry = z.object({ label: z.string().trim().min(1).max(180), value: z.string().trim().min(1).max(1200) });
export const companyFactsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  introduction: z.string().trim().min(1).max(700),
  reviewed: z.iso.date(),
  facts: z.array(entry).min(1).max(24),
  questions: z.array(entry).max(20),
});
export type CompanyFacts = z.infer<typeof companyFactsSchema>;
