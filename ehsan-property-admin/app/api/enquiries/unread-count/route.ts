import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const GET = route({ resource: 'enquiry', action: 'read' }, async () => {
  const unread = await prisma.enquiry.count({ where: { status: 'NEW' } });
  return json({ unread });
});
