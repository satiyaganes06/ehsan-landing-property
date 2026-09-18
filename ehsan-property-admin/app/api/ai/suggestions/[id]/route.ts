import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const Body = z.object({ accepted: z.boolean() });

/** Accepting or dismissing a suggestion — the panel never writes AI output
    into a field directly, so this records which way the editor went. */
export const PATCH = route<{ id: string }>(
  { resource: 'ai', action: 'use' },
  async ({ request, params }) => {
    const { accepted } = Body.parse(await request.json());
    return json(await prisma.aiSuggestion.update({ where: { id: params.id }, data: { accepted } }));
  },
);
