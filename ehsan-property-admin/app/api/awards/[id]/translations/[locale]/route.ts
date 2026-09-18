import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';
import { LocaleSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

const TranslationBody = z.object({
  name: z.string().min(1),
  issuer: z.string().nullable().optional(),
  description: z.string(),
});

export const PUT = route<{ id: string; locale: string }>(
  { resource: 'award', action: 'update' },
  async ({ request, params }) => {
    const locale = LocaleSchema.parse(params.locale);
    const data = TranslationBody.parse(await request.json());
    const translation = await prisma.awardTranslation.upsert({
      where: { awardId_locale: { awardId: params.id, locale } },
      create: { awardId: params.id, locale, ...data },
      update: data,
    });
    return json(translation);
  },
);
