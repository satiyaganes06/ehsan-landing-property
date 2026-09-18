import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>(
  { resource: 'event', action: 'read' },
  async ({ params }) =>
    json(
      await prisma.revision.findMany({
        where: { entityType: { in: ['event', 'event_translation'] }, entityId: params.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ),
);
