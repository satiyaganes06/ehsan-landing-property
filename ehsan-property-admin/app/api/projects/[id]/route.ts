import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit, recordRevision } from '@/lib/server/audit';
import { recomputeSeo } from '@/lib/server/recompute-seo';
import { scoringInputFor } from '@/lib/server/seo-input';
import { canActOnOwnRecord } from '@/lib/server/ownership';
import { clientIp, forbiddenOwnership, json, noContent, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const ProjectStatus = z.enum(['COMPLETED', 'ONGOING', 'FUTURE']);

const UpdateProjectBody = z.object({
  status: ProjectStatus.optional(),
  yearStart: z.string().nullable().optional(),
  yearEnd: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  units: z.string().nullable().optional(),
  areaText: z.string().nullable().optional(),
  priceRange: z.string().nullable().optional(),
  occupancy: z.string().nullable().optional(),
  gdvMillions: z.number().nullable().optional(),
  barWeight: z.number().min(0).max(1).nullable().optional(),
  relatedReferences: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

export const GET = route<{ id: string }>({ resource: 'project', action: 'read' }, async ({ params }) => {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      translations: true,
      media: { orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }], include: { media: true } },
    },
  });
  if (!project) return json({ error: 'not_found', message: 'Project not found.' }, 404);

  // SeoMeta is polymorphic (entityType/entityId), not a Prisma relation, so
  // it cannot be an include. Fetched separately and merged in.
  const seoMeta = await prisma.seoMeta.findMany({
    where: { entityType: 'project', entityId: project.id },
  });
  return json({ ...project, seoMeta });
});

export const PATCH = route<{ id: string }>(
  { resource: 'project', action: 'update' },
  async ({ request, params, user }) => {
    const data = UpdateProjectBody.parse(await request.json());

    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) return json({ error: 'not_found', message: 'Project not found.' }, 404);
    if (!canActOnOwnRecord(user, existing.createdById)) return forbiddenOwnership();

    recordRevision('project', existing.id, existing, user.id);
    const project = await prisma.project.update({
      where: { id: params.id },
      data: data as never,
    });

    const scoring = await scoringInputFor('project', project.id, 'EN');
    await recomputeSeo({ entityType: 'project', entityId: project.id, locale: 'EN', ...scoring });

    recordAudit({
      actorId: user.id, action: 'project.updated', entityType: 'project',
      entityId: project.id, diff: data, ip: clientIp(request),
    });
    return json(project);
  },
);

export const DELETE = route<{ id: string }>(
  { resource: 'project', action: 'delete' },
  async ({ request, params, user }) => {
    await prisma.project.delete({ where: { id: params.id } });
    recordAudit({
      actorId: user.id, action: 'project.deleted', entityType: 'project',
      entityId: params.id, ip: clientIp(request),
    });
    return noContent();
  },
);
