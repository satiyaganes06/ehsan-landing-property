import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { rebuildProjectsJson } from '@/lib/server/bridge';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const POST = route<{ id: string }>(
  { resource: 'project', action: 'publish' },
  async ({ request, params, user }) => {
    const translation = await prisma.projectTranslation.findUnique({
      where: { projectId_locale: { projectId: params.id, locale: 'EN' } },
    });
    if (!translation) {
      return json({ error: 'bad_request', message: 'Add English content before publishing.' }, 400);
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: { publishState: 'PUBLISHED', publishedAt: new Date() },
    });
    const { count } = await rebuildProjectsJson();

    recordAudit({
      actorId: user.id, action: 'project.published', entityType: 'project',
      entityId: project.id, ip: clientIp(request),
    });
    return json({ ...project, sitePublishedCount: count });
  },
);
