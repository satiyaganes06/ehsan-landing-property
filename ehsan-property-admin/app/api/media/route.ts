import { prisma } from '@/lib/server/prisma';
import { mediaUrl } from '@/lib/server/media-url';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const GET = route({ resource: 'media', action: 'read' }, async ({ request }) => {
  const q = request.nextUrl.searchParams;
  const where: Record<string, unknown> = {};
  if (q.get('q')) where.filename = { contains: q.get('q'), mode: 'insensitive' };
  if (q.get('missingAlt') === 'true') where.altText = null;

  const items = await prisma.media.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 200,
  });
  return json(items.map((m) => ({ ...m, url: mediaUrl(m.storageKey) })));
});
