import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit, recordRevision } from '@/lib/server/audit';
import { clientIp, json, route } from '@/lib/server/route';
import { LocaleSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

const ValueBody = z.object({ value: z.unknown() });

export const PUT = route<{ key: string; locale: string }>(
  { resource: 'block', action: 'update' },
  async ({ request, params, user }) => {
    const locale = LocaleSchema.parse(params.locale);
    const body = ValueBody.parse(await request.json());

    const block = await prisma.textBlock.findUnique({ where: { key: params.key } });
    if (!block) {
      return json({ error: 'not_found', message: `No block with key "${params.key}".` }, 404);
    }

    const where = { textBlockId_locale: { textBlockId: block.id, locale } };
    const existing = await prisma.textBlockTranslation.findUnique({ where });
    if (existing) recordRevision('text_block_translation', existing.id, existing, user.id);

    const translation = await prisma.textBlockTranslation.upsert({
      where,
      create: { textBlockId: block.id, locale, value: body.value as never },
      update: { value: body.value as never },
    });

    recordAudit({
      actorId: user.id, action: 'block.updated', entityType: 'block',
      entityId: block.id, ip: clientIp(request),
    });
    return json(translation);
  },
);
