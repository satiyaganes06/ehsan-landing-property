import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const TestimonialBody = z.object({
  reference: z.string().min(1),
  mediaId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isPlaceholder: z.boolean().default(false),
});

export const GET = route({ resource: 'testimonial', action: 'read' }, async () => {
  const items = await prisma.testimonial.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { translations: { where: { locale: 'EN' } } },
  });
  return json(
    items.map((t) => ({
      id: t.id, reference: t.reference, sortOrder: t.sortOrder,
      isPlaceholder: t.isPlaceholder, publishState: t.publishState,
      author: t.translations[0]?.author ?? '(untranslated)',
      quote: t.translations[0]?.quote ?? '',
    })),
  );
});

export const POST = route({ resource: 'testimonial', action: 'create' }, async ({ request, user }) => {
  const data = TestimonialBody.parse(await request.json());
  const item = await prisma.testimonial.create({ data: { ...data, publishState: 'DRAFT' } });
  recordAudit({
    actorId: user.id, action: 'testimonial.created', entityType: 'testimonial',
    entityId: item.id, ip: clientIp(request),
  });
  return json(item, 201);
});
