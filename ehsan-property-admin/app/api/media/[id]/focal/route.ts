import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const FocalBody = z.object({
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
});

export const PATCH = route<{ id: string }>(
  { resource: 'media', action: 'update' },
  async ({ request, params }) => {
    const data = FocalBody.parse(await request.json());
    return json(await prisma.media.update({ where: { id: params.id }, data }));
  },
);
