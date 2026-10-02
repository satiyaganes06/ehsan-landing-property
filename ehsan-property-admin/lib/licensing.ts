import { z } from 'zod';

export const licensingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  intro: z.string().max(2000),
  records: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/).max(100),
    project: z.string().trim().min(1).max(200),
    phase: z.string().max(100),
    published: z.boolean(),
    notice: z.string().max(2000),
    fields: z.array(z.object({ label: z.string().trim().min(1).max(300), value: z.string().max(15000) })).max(60),
  })).max(100),
}).refine(data => new Set(data.records.map(record => record.id)).size === data.records.length, { message: 'Each licensing entry must have a unique ID.' });
export type Licensing = z.infer<typeof licensingSchema>;
