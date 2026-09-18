import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const GET = route({ resource: 'audit', action: 'read' }, async ({ request }) => {
  const q = request.nextUrl.searchParams;
  const entries = await prisma.auditEntry.findMany({
    where: {
      entityType: q.get('entityType') ?? undefined,
      entityId: q.get('entityId') ?? undefined,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number.parseInt(q.get('limit') ?? '50', 10) || 50, 200),
    include: { actor: { select: { name: true, email: true } } },
  });
  return json(entries);
});
