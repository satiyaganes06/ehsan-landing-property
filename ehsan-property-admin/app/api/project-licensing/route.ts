import { licensingSchema } from '@/lib/licensing';
import { prisma } from '@/lib/server/prisma';
import { readLicensing, licensingKey } from '@/lib/server/licensing';
import { route, json, clientIp } from '@/lib/server/route';
import { recordAudit, recordRevision } from '@/lib/server/audit';

export const runtime = 'nodejs';
export const GET = route({ resource: 'block', action: 'read' }, async () => json(await readLicensing()));
export const PUT = route({ resource: 'block', action: 'update' }, async ({ request, user }) => {
  const next = licensingSchema.parse(await request.json());
  const block = await prisma.$transaction(async tx => {
    const row = await tx.textBlock.upsert({ where: { key: licensingKey }, create: { key: licensingKey, label: 'Project Licensing', kind: 'configuration', group: 'licensing' }, update: {} });
    const existing = await tx.textBlockTranslation.findUnique({ where: { textBlockId_locale: { textBlockId: row.id, locale: 'EN' } } });
    if (existing) recordRevision('text_block_translation', existing.id, existing, user.id);
    await tx.textBlockTranslation.upsert({ where: { textBlockId_locale: { textBlockId: row.id, locale: 'EN' } }, create: { textBlockId: row.id, locale: 'EN', value: next }, update: { value: next } });
    return row;
  });
  recordAudit({ actorId: user.id, action: 'licensing.updated', entityType: 'block', entityId: block.id, ip: clientIp(request) });
  return json(next);
});
