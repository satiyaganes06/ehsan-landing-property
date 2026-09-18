import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const AltTextBody = z.object({ altText: z.string().max(200) });

export const PATCH = route<{ id: string }>(
  { resource: 'media', action: 'update' },
  async ({ request, params }) => {
    const { altText } = AltTextBody.parse(await request.json());
    return json(await prisma.media.update({ where: { id: params.id }, data: { altText } }));
  },
);
