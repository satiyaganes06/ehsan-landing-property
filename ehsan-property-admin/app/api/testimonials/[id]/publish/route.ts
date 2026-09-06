import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const POST = route<{ id: string }>(
  { resource: 'testimonial', action: 'publish' },
  async ({ request, params, user }) => {
    const item = await prisma.testimonial.update({
      where: { id: params.id },
      data: { publishState: 'PUBLISHED' },
    });
    recordAudit({
      actorId: user.id, action: 'testimonial.published', entityType: 'testimonial',
      entityId: item.id, ip: clientIp(request),
    });
    return json(item);
  },
);
