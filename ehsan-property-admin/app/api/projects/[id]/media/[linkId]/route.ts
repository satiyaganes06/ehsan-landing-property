import { prisma } from '@/lib/server/prisma';
import { noContent, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const DELETE = route<{ id: string; linkId: string }>(
  { resource: 'project', action: 'update' },
  async ({ params }) => {
    // Detaching something already detached is still "detached".
    await prisma.projectMedia.delete({ where: { id: params.linkId } }).catch(() => {});
    return noContent();
  },
);
