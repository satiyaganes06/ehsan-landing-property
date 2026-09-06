import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
import { uniqueSlug } from '@/lib/server/slug';
import { clientIp, json, route } from '@/lib/server/route';
import { PaginationSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

const ProjectStatus = z.enum(['COMPLETED', 'ONGOING', 'FUTURE']);

const CreateProjectBody = z.object({
  reference: z.string().min(1),
  status: ProjectStatus,
  name: z.string().min(1),
  location: z.string().min(1),
  description: z.string().default(''),
});

export const GET = route({ resource: 'project', action: 'read' }, async ({ request }) => {
  const q = Object.fromEntries(request.nextUrl.searchParams);
  const { page, perPage } = PaginationSchema.parse(q);

  const where: Record<string, unknown> = {};
  if (q.publishState) where.publishState = q.publishState;
  if (q.status) where.status = q.status;

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where, orderBy: { sortOrder: 'asc' },
      skip: (page - 1) * perPage, take: perPage,
      include: { translations: { where: { locale: 'EN' } } },
    }),
  ]);

  const seoRows = await prisma.seoMeta.findMany({
    where: { entityType: 'project', entityId: { in: projects.map((p) => p.id) }, locale: 'EN' },
  });
  const seoByProject = new Map(seoRows.map((s) => [s.entityId, s]));

  return json({
    page, perPage, total,
    items: projects.map((p) => ({
      id: p.id, reference: p.reference, status: p.status, publishState: p.publishState,
      yearStart: p.yearStart, yearEnd: p.yearEnd, sortOrder: p.sortOrder,
      name: p.translations[0]?.name ?? '(untranslated)',
      location: p.translations[0]?.location ?? '',
      seoScore: seoByProject.get(p.id)?.score ?? 0,
      seoBand: seoByProject.get(p.id)?.band ?? 'BAD',
    })),
  });
});

export const POST = route({ resource: 'project', action: 'create' }, async ({ request, user }) => {
  const { reference, status, name, location, description } = CreateProjectBody.parse(await request.json());

  if (await prisma.project.findUnique({ where: { reference } })) {
    return json({ error: 'conflict', message: `Reference "${reference}" is already in use.` }, 409);
  }

  const maxOrder = await prisma.project.aggregate({ _max: { sortOrder: true } });
  const slug = await uniqueSlug(name, async (candidate) =>
    Boolean(await prisma.projectTranslation.findUnique({
      where: { locale_slug: { locale: 'EN', slug: candidate } },
    })),
  );

  const project = await prisma.project.create({
    data: {
      reference, status,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      createdById: user.id, publishState: 'DRAFT',
      translations: { create: { locale: 'EN', slug, name, location, description, amenities: [] } },
    },
    include: { translations: true },
  });

  recordAudit({
    actorId: user.id, action: 'project.created', entityType: 'project',
    entityId: project.id, ip: clientIp(request),
  });
  return json(project, 201);
});
