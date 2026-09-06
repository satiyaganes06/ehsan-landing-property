import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const GET = route({ resource: 'user', action: 'read' }, async () => {
  const roles = await prisma.role.findMany({
    orderBy: { rank: 'asc' },
    include: { permissions: { include: { permission: true } } },
  });
  return json(
    roles.map((r) => ({
      key: r.key,
      label: r.label,
      permissions: r.permissions.map((p) => `${p.permission.resource}:${p.permission.action}`),
    })),
  );
});
