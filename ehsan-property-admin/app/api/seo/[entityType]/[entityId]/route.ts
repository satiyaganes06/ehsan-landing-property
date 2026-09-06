import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const EntityType = z.enum(['project', 'event']);

export const GET = route<{ entityType: string; entityId: string }>(
  { resource: 'project', action: 'read' },
  async ({ params }) => {
    const entityType = EntityType.parse(params.entityType);
    const rows = await prisma.seoMeta.findMany({
      where: { entityType, entityId: params.entityId },
    });
    return json(rows);
  },
);
