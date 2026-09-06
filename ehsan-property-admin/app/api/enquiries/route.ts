import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';
import { PaginationSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

export const GET = route({ resource: 'enquiry', action: 'read' }, async ({ request }) => {
  const q = Object.fromEntries(request.nextUrl.searchParams);
  const { page, perPage } = PaginationSchema.parse(q);

  const where: Record<string, unknown> = {};
  if (q.status) where.status = q.status;
  if (q.assignedTo) where.assignedTo = q.assignedTo;

  const [total, items] = await Promise.all([
    prisma.enquiry.count({ where }),
    prisma.enquiry.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage, take: perPage,
      include: { assignee: { select: { name: true } } },
    }),
  ]);
  return json({ page, perPage, total, items });
});
