import { z } from 'zod';

export const LocaleSchema = z.enum(['EN', 'MS']);
export const PublishStateSchema = z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']);

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const IdParamSchema = z.object({ id: z.string().min(1) });
