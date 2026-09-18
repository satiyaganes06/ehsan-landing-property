import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit, recordRevision } from '@/lib/server/audit';
import { recomputeSeo } from '@/lib/server/recompute-seo';
import { scoringInputFor } from '@/lib/server/seo-input';
import { canActOnOwnRecord } from '@/lib/server/ownership';
import { uniqueSlug } from '@/lib/server/slug';
import { clientIp, forbiddenOwnership, json, route } from '@/lib/server/route';
import { LocaleSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

const TranslationBody = z.object({
  slug: z.string().min(1).optional(), // derived from the name when omitted
  name: z.string().min(1),
  location: z.string().min(1),
  description: z.string(),
  amenities: z.array(z.string()).default([]),
  certificate: z.string().nullable().optional(),
});

export const PUT = route<{ id: string; locale: string }>(
  { resource: 'project', action: 'update' },
  async ({ request, params, user }) => {
    const locale = LocaleSchema.parse(params.locale);
    const body = TranslationBody.parse(await request.json());

    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) return json({ error: 'not_found', message: 'Project not found.' }, 404);
    if (!canActOnOwnRecord(user, project.createdById)) return forbiddenOwnership();

    const slug =
      body.slug ??
      (await uniqueSlug(body.name, async (candidate) => {
        const hit = await prisma.projectTranslation.findUnique({
          where: { locale_slug: { locale, slug: candidate } },
        });
        return Boolean(hit && hit.projectId !== project.id);
      }));

    const where = { projectId_locale: { projectId: project.id, locale } };
    const existing = await prisma.projectTranslation.findUnique({ where });
    if (existing) recordRevision('project_translation', existing.id, existing, user.id);

    const translation = await prisma.projectTranslation.upsert({
      where,
      create: { projectId: project.id, locale, slug, ...body },
      update: { slug, ...body },
    });

    const scoring = await scoringInputFor('project', project.id, locale);
    await recomputeSeo({ entityType: 'project', entityId: project.id, locale, ...scoring });

    recordAudit({
      actorId: user.id, action: 'project.translation.updated', entityType: 'project',
      entityId: project.id, ip: clientIp(request),
    });
    return json(translation);
  },
);
