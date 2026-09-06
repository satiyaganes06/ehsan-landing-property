import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, noContent, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const AwardPatch = z.object({
  reference: z.string().min(1),
  year: z.number().int(),
  mediaId: z.string().nullable().optional(),
  sortOrder: z.number().int(),
}).partial();

export const GET = route<{ id: string }>({ resource: 'award', action: 'read' }, async ({ params }) => {
  const award = await prisma.award.findUnique({
    where: { id: params.id },
    include: { translations: true, media: true },
  });
  if (!award) return json({ error: 'not_found', message: 'Award not found.' }, 404);
  return json(award);
});

export const PATCH = route<{ id: string }>(
  { resource: 'award', action: 'update' },
  async ({ request, params, user }) => {
    const data = AwardPatch.parse(await request.json());
    const award = await prisma.award.update({ where: { id: params.id }, data });
    recordAudit({
      actorId: user.id, action: 'award.updated', entityType: 'award',
      entityId: award.id, diff: data, ip: clientIp(request),
    });
    return json(award);
  },
);

export const DELETE = route<{ id: string }>(
  { resource: 'award', action: 'delete' },
  async ({ request, params, user }) => {
    await prisma.award.delete({ where: { id: params.id } });
    recordAudit({
      actorId: user.id, action: 'award.deleted', entityType: 'award',
      entityId: params.id, ip: clientIp(request),
    });
    return noContent();
  },
);
