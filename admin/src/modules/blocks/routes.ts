import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { recordAudit, recordRevision } from '../../lib/audit.js';
import { clientIp } from '../../lib/http.js';
import { LocaleSchema } from '../../lib/validation.js';

const ValueBody = z.object({ value: z.unknown() });

export async function blockRoutes(app: FastifyInstance) {
  // Grouped by section (hero, prelude, doctrine, commitment, contact) so the
  // panel can render one screen per part of the page rather than one flat
  // list of 14+ unrelated fields.
  app.get('/api/blocks', { preHandler: requirePermission('block', 'read') }, async (req) => {
    const q = req.query as { locale?: string };
    const locale = (q.locale as 'EN' | 'MS') ?? 'EN';
    const blocks = await prisma.textBlock.findMany({
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
      include: { translations: { where: { locale } } },
    });
    return blocks.map((b) => ({
      id: b.id, key: b.key, label: b.label, kind: b.kind, group: b.group,
      value: b.translations[0]?.value ?? null,
      hasTranslation: b.translations.length > 0,
    }));
  });

  app.put('/api/blocks/:key/translations/:locale', { preHandler: requirePermission('block', 'update') }, async (req, reply) => {
    const params = z.object({ key: z.string(), locale: LocaleSchema }).safeParse(req.params);
    const body = ValueBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });

    const block = await prisma.textBlock.findUnique({ where: { key: params.data.key } });
    if (!block) return reply.code(404).send({ error: 'not_found', message: `No block with key "${params.data.key}".` });

    const existing = await prisma.textBlockTranslation.findUnique({
      where: { textBlockId_locale: { textBlockId: block.id, locale: params.data.locale } },
    });
    if (existing) recordRevision('text_block_translation', existing.id, existing, req.user!.id);

    const translation = await prisma.textBlockTranslation.upsert({
      where: { textBlockId_locale: { textBlockId: block.id, locale: params.data.locale } },
      create: { textBlockId: block.id, locale: params.data.locale, value: body.data.value as any },
      update: { value: body.data.value as any },
    });

    recordAudit({ actorId: req.user!.id, action: 'block.updated', entityType: 'block', entityId: block.id, ip: clientIp(req) });
    return reply.send(translation);
  });
}
