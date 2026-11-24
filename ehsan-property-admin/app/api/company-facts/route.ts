import { readBoundedJson } from '@/lib/server/bounded-json';
import { mirrorCompanyFacts } from '@/lib/server/company-facts-mirror';
import { buildProjectsPayload } from '@/lib/server/bridge';
import { companyFactsSchema } from '@/lib/company-facts';
import { prisma } from '@/lib/server/prisma';
import { readCompanyFacts, companyFactsKey } from '@/lib/server/company-facts';
import { route, json, clientIp } from '@/lib/server/route';
import { recordAudit, recordRevision } from '@/lib/server/audit';

export const runtime = 'nodejs';
export const GET = route({ resource: 'block', action: 'read' }, async () => json(await readCompanyFacts()));
export const PUT = route({ resource: 'block', action: 'update' }, async ({ request, user }) => {
  const body = await readBoundedJson(request, 256 * 1024);
  if (!body.ok) return json({ message: 'Invalid or oversized company profile.' }, body.status);
  const next = companyFactsSchema.parse(body.value);
  const block = await prisma.$transaction(async tx => {
    const row = await tx.textBlock.upsert({ where: { key: companyFactsKey }, create: { key: companyFactsKey, label: 'Company Facts', kind: 'configuration', group: 'company-facts' }, update: {} });
    const existing = await tx.textBlockTranslation.findUnique({ where: { textBlockId_locale: { textBlockId: row.id, locale: 'EN' } } });
    if (existing) recordRevision('text_block_translation', existing.id, existing, user.id);
    await tx.textBlockTranslation.upsert({ where: { textBlockId_locale: { textBlockId: row.id, locale: 'EN' } }, create: { textBlockId: row.id, locale: 'EN', value: next }, update: { value: next } });
    return row;
  });
  recordAudit({ actorId: user.id, action: 'company-facts.updated', entityType: 'block', entityId: block.id, ip: clientIp(request) });
  if (!process.env.VERCEL) await mirrorCompanyFacts(await buildProjectsPayload());
  return json(next);
});
