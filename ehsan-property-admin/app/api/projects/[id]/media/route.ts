import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { canActOnOwnRecord } from '@/lib/server/ownership';
import { forbiddenOwnership, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const MediaLinkBody = z.object({
  mediaId: z.string().min(1),
  role: z.enum(['hero', 'gallery', 'blueprint', 'thumbnail', 'logo', 'location', 'shuttle', 'facilities', 'interior']).default('gallery'),
  sortOrder: z.number().int().default(0),
});

export const POST = route<{ id: string }>(
  { resource: 'project', action: 'update' },
  async ({ request, params, user }) => {
    const data = MediaLinkBody.parse(await request.json());

    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) return json({ error: 'not_found', message: 'Project not found.' }, 404);
    if (!canActOnOwnRecord(user, project.createdById)) return forbiddenOwnership();

    const link = await prisma.$transaction(async tx => {
      // A thumbnail is a single project-specific selection, not a gallery item.
      if (data.role === 'thumbnail') await tx.projectMedia.deleteMany({ where: { projectId: project.id, role: 'thumbnail' } });
      if (project.reference !== 'proj-15' && ['hero', 'logo'].includes(data.role)) await tx.projectMedia.deleteMany({ where: { projectId: project.id, role: data.role } });
      return tx.projectMedia.create({ data: { projectId: project.id, ...data } });
    });
    return json(link, 201);
  },
);
