import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { rebuildProjectsJson } from '@/lib/server/bridge';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const POST = route<{ id: string }>(
  { resource: 'project', action: 'publish' },
  async ({ request, params, user }) => {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: { publishState: 'DRAFT' },
    });
    await rebuildProjectsJson();
    recordAudit({
      actorId: user.id, action: 'project.unpublished', entityType: 'project',
      entityId: project.id, ip: clientIp(request),
    });
    return json(project);
  },
);
