import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const POST = route<{ id: string }>(
  { resource: 'award', action: 'publish' },
  async ({ request, params, user }) => {
    const award = await prisma.award.update({
      where: { id: params.id },
      data: { publishState: 'PUBLISHED' },
    });
    recordAudit({
      actorId: user.id, action: 'award.published', entityType: 'award',
      entityId: award.id, ip: clientIp(request),
    });
    return json(award);
  },
);
