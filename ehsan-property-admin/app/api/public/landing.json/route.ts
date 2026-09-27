import { prisma } from '@/lib/server/prisma';
import { publicRoute } from '@/lib/server/route';
import { buildProjectsPayload, buildEventsPayload } from '@/lib/server/bridge';
import { mediaUrl } from '@/lib/server/media-url';

export const runtime = 'nodejs';
export const GET = publicRoute(async () => {
  const block = await prisma.textBlock.findUnique({ where: { key: 'landing.customization' }, include: { translations: { where: { locale: 'EN' } } } });
  const [projects, events, awards, testimonials] = await Promise.all([
    buildProjectsPayload(), buildEventsPayload(),
    prisma.award.findMany({ where: { publishState: 'PUBLISHED' }, orderBy: { sortOrder: 'asc' }, include: { translations: { where: { locale: 'EN' } }, media: true } }),
    prisma.testimonial.findMany({ where: { publishState: 'PUBLISHED' }, orderBy: { sortOrder: 'asc' }, include: { translations: { where: { locale: 'EN' } }, media: true } }),
  ]);
  return Response.json({ ...(block?.translations[0]?.value as object ?? { values: {} }), projects, events,
    awards: awards.map(item => ({ reference: item.reference, year: item.year, name: item.translations[0]?.name, description: item.translations[0]?.description, image: item.media ? mediaUrl(item.media.storageKey) : null })),
    testimonials: testimonials.map(item => ({ reference: item.reference, quote: item.translations[0]?.quote, author: item.translations[0]?.author, role: item.translations[0]?.role, groupLabel: item.translations[0]?.groupLabel, image: item.media ? mediaUrl(item.media.storageKey) : null })),
  }, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  });
});
