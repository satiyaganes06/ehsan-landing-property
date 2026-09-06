import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { mediaUrl } from '@/lib/server/media-url';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const AwardBody = z.object({
  reference: z.string().min(1),
  year: z.number().int(),
  mediaId: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export const GET = route({ resource: 'award', action: 'read' }, async () => {
  const awards = await prisma.award.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { translations: { where: { locale: 'EN' } }, media: true },
  });
  return json(
    awards.map((a) => ({
      id: a.id, reference: a.reference, year: a.year, sortOrder: a.sortOrder,
      publishState: a.publishState,
      name: a.translations[0]?.name ?? '(untranslated)',
      mediaUrl: a.media ? mediaUrl(a.media.storageKey) : null,
    })),
  );
});

export const POST = route({ resource: 'award', action: 'create' }, async ({ request, user }) => {
  const data = AwardBody.parse(await request.json());
  const award = await prisma.award.create({ data: { ...data, publishState: 'DRAFT' } });
  recordAudit({
    actorId: user.id, action: 'award.created', entityType: 'award',
    entityId: award.id, ip: clientIp(request),
  });
  return json(award, 201);
});
