import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, noContent, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const PatchBody = z.object({
  status: z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED', 'SPAM']).optional(),
  assignedTo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const GET = route<{ id: string }>({ resource: 'enquiry', action: 'read' }, async ({ params }) => {
  const enquiry = await prisma.enquiry.findUnique({ where: { id: params.id } });
  if (!enquiry) return json({ error: 'not_found', message: 'Enquiry not found.' }, 404);

  // Opening an enquiry is what marks it read.
  if (enquiry.status === 'NEW') {
    await prisma.enquiry.update({ where: { id: enquiry.id }, data: { status: 'READ' } });
    enquiry.status = 'READ';
  }
  return json(enquiry);
});

export const PATCH = route<{ id: string }>(
  { resource: 'enquiry', action: 'update' },
  async ({ request, params, user }) => {
    const data = PatchBody.parse(await request.json());
    const enquiry = await prisma.enquiry.update({ where: { id: params.id }, data });
    recordAudit({
      actorId: user.id, action: 'enquiry.updated', entityType: 'enquiry',
      entityId: enquiry.id, diff: data, ip: clientIp(request),
    });
    return json(enquiry);
  },
);

export const DELETE = route<{ id: string }>(
  { resource: 'enquiry', action: 'delete' },
  async ({ request, params, user }) => {
    await prisma.enquiry.delete({ where: { id: params.id } });
    recordAudit({
      actorId: user.id, action: 'enquiry.deleted', entityType: 'enquiry',
      entityId: params.id, ip: clientIp(request),
    });
    return noContent();
  },
);
