import { prisma } from '@/lib/server/prisma';
import { deleteUpload } from '@/lib/server/storage';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, noContent, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const DELETE = route<{ id: string }>(
  { resource: 'media', action: 'delete' },
  async ({ request, params, user }) => {
    const media = await prisma.media.findUnique({ where: { id: params.id } });
    if (!media) return json({ error: 'not_found', message: 'Image not found.' }, 404);

    const inUse = await prisma.projectMedia.count({ where: { mediaId: media.id } });
    if (inUse > 0) {
      return json(
        { error: 'conflict', message: `Still attached to ${inUse} project(s) — detach first.` },
        409,
      );
    }

    await prisma.media.delete({ where: { id: media.id } });
    await deleteUpload(media.storageKey);

    recordAudit({
      actorId: user.id, action: 'media.deleted', entityType: 'media',
      entityId: params.id, ip: clientIp(request),
    });
    return noContent();
  },
);
