import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>(
  { resource: 'project', action: 'read' },
  async ({ params }) =>
    json(
      await prisma.revision.findMany({
        where: { entityType: { in: ['project', 'project_translation'] }, entityId: params.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ),
);
