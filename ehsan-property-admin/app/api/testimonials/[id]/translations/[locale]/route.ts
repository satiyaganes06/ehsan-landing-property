import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';
import { LocaleSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

const TranslationBody = z.object({
  quote: z.string().min(1),
  author: z.string().min(1),
  role: z.string().min(1),
  groupLabel: z.string().nullable().optional(),
});

export const PUT = route<{ id: string; locale: string }>(
  { resource: 'testimonial', action: 'update' },
  async ({ request, params }) => {
    const locale = LocaleSchema.parse(params.locale);
    const data = TranslationBody.parse(await request.json());
    const translation = await prisma.testimonialTranslation.upsert({
      where: { testimonialId_locale: { testimonialId: params.id, locale } },
      create: { testimonialId: params.id, locale, ...data },
      update: data,
    });
    return json(translation);
  },
);
