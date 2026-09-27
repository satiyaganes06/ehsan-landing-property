import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';
import { recordAudit, recordRevision } from '@/lib/server/audit';

export const runtime = 'nodejs';
const key = 'landing.customization';
const schema = z.object({ values: z.record(z.string().max(300), z.string().max(20000)) });
const statisticCards = z.array(z.object({ id: z.string().min(1).max(100), value: z.string().max(100), title: z.string().max(4000), unit: z.string().max(30).optional(), subtitle: z.string().max(2000).optional() })).max(30).refine(cards => new Set(cards.map(card => card.id)).size === cards.length, 'Statistic IDs must be unique.');

export const GET = route({ resource: 'block', action: 'read' }, async () => {
  const block = await prisma.textBlock.findUnique({ where: { key }, include: { translations: { where: { locale: 'EN' } } } });
  return json(block?.translations[0]?.value ?? { values: {} });
});

export const PUT = route({ resource: 'block', action: 'update' }, async ({ request, user }) => {
  const body = schema.parse(await request.json());
  for (const statisticKey of ['about:statistics', 'record:statistics']) {
    if (body.values[statisticKey] === undefined) continue;
    try { statisticCards.parse(JSON.parse(body.values[statisticKey])); }
    catch { return json({ message: 'Use up to 30 statistic cards with a text value and title.' }, 400); }
  }
  for (const [field, value] of Object.entries(body.values)) {
    if (field.endsWith(':heading')) {
      try { z.object({ label: z.string().max(4000), title: z.string().max(8000), introduction: z.string().max(8000) }).parse(JSON.parse(value)); }
      catch { return json({ message: 'Use a valid section label, title and introduction.' }, 400); }
    }
    if (field === 'gallery:images') {
      try {
        const photos = z.array(z.object({ id: z.string().min(1).max(100), src: z.string().max(2000), alt: z.string().max(500) })).max(30).parse(JSON.parse(value));
        if (new Set(photos.map(photo => photo.id)).size !== photos.length || photos.some(photo => !['http:', 'https:'].includes(new URL(photo.src, 'https://ehsan.invalid').protocol))) throw new Error('Invalid images');
      } catch { return json({ message: 'Use up to 30 gallery images with safe image paths and descriptions.' }, 400); }
    }
  }
  if (Object.keys(body.values).length > 5000) return json({ message: 'Too many fields.' }, 400);
  for (const [field, value] of Object.entries(body.values)) {
    if (/:(src|href|background)$/.test(field)) {
      try {
        if (!['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(value, 'https://ehsan.invalid').protocol)) return json({ message: 'Use a safe image path or link.' }, 400);
      } catch { return json({ message: 'Use a valid image path or link.' }, 400); }
    }
  }
  const block = await prisma.textBlock.upsert({
    where: { key },
    create: { key, label: 'Landing page', kind: 'configuration', group: 'landing' },
    update: {},
  });
  const existing = await prisma.textBlockTranslation.findUnique({ where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } } });
  if (existing) recordRevision('text_block_translation', existing.id, existing, user.id);
  await prisma.textBlockTranslation.upsert({
    where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } },
    create: { textBlockId: block.id, locale: 'EN', value: body },
    update: { value: body },
  });
  recordAudit({ actorId: user.id, action: 'landing.updated', entityType: 'block', entityId: block.id });
  return json(body);
});
