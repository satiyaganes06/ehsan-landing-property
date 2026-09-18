import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, noContent, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const Patch = z.object({
  reference: z.string().min(1),
  mediaId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  isPlaceholder: z.boolean(),
}).partial();

export const GET = route<{ id: string }>({ resource: 'testimonial', action: 'read' }, async ({ params }) => {
  const item = await prisma.testimonial.findUnique({
    where: { id: params.id },
    include: { translations: true },
  });
  if (!item) return json({ error: 'not_found', message: 'Testimonial not found.' }, 404);
  return json(item);
});

export const PATCH = route<{ id: string }>(
  { resource: 'testimonial', action: 'update' },
  async ({ request, params, user }) => {
    const data = Patch.parse(await request.json());
    const item = await prisma.testimonial.update({ where: { id: params.id }, data });
    recordAudit({
      actorId: user.id, action: 'testimonial.updated', entityType: 'testimonial',
      entityId: item.id, diff: data, ip: clientIp(request),
    });
    return json(item);
  },
);

export const DELETE = route<{ id: string }>(
  { resource: 'testimonial', action: 'delete' },
  async ({ request, params, user }) => {
    await prisma.testimonial.delete({ where: { id: params.id } });
    recordAudit({
      actorId: user.id, action: 'testimonial.deleted', entityType: 'testimonial',
      entityId: params.id, ip: clientIp(request),
    });
    return noContent();
  },
);
