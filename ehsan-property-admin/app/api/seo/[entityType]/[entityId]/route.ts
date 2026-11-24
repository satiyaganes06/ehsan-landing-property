import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const EntityType = z.enum(['project', 'event']);

export const GET = route<{ entityType: string; entityId: string }>(
  { auth: true },
  async ({ params, user }) => {
    const entityType = EntityType.parse(params.entityType);
    if (!user.permissions.has(`${entityType}:read`)) {
      return json({ error: 'forbidden', message: 'Permission denied.' }, 403);
    }
    const rows = await prisma.seoMeta.findMany({
      where: { entityType, entityId: params.entityId }, include:{ogMedia:{select:{storageKey:true}}},
    });
    return json(rows);
  },
);
