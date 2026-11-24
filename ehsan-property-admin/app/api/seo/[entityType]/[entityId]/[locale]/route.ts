import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recomputeSeo } from '@/lib/server/recompute-seo';
import { scoringInputFor } from '@/lib/server/seo-input';
import { recordAudit } from '@/lib/server/audit';
import { canActOnOwnRecord } from '@/lib/server/ownership';
import { clientIp, forbiddenOwnership, json, route } from '@/lib/server/route';
import { LocaleSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

const EntityType = z.enum(['project', 'event']);

const SeoMetaBody = z.object({
  focusKeyword: z.string().nullable().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
  ogTitle: z.string().nullable().optional(),
  ogDescription: z.string().nullable().optional(),
  ogMediaId: z.string().nullable().optional(),
});

export const PUT = route<{ entityType: string; entityId: string; locale: string }>(
  { auth: true },
  async ({ request, params, user }) => {
    const entityType = EntityType.parse(params.entityType);
    if (!user.permissions.has(`${entityType}:update`)) {
      return json({ error: 'forbidden', message: 'Permission denied.' }, 403);
    }
    const locale = LocaleSchema.parse(params.locale);
    const data = SeoMetaBody.parse(await request.json());
    const { entityId } = params;
    const lookup = { where: { id: entityId }, select: { createdById: true } };
    const record = entityType === 'project'
      ? await prisma.project.findUnique(lookup)
      : await prisma.event.findUnique(lookup);
    if (!record) return json({ error: 'not_found', message: 'Record not found.' }, 404);
    if (!canActOnOwnRecord(user, record.createdById)) return forbiddenOwnership();

    await prisma.seoMeta.upsert({
      where: { entityType_entityId_locale: { entityType, entityId, locale } },
      create: { entityType, entityId, locale, ...data },
      update: data,
    });

    // The score is recomputed server-side on every write: a score that moved
    // between reads would be a score nobody trusts.
    const scoring = await scoringInputFor(entityType, entityId, locale);
    await recomputeSeo({ entityType, entityId, locale, ...scoring });

    recordAudit({
      actorId: user.id, action: 'seo.updated', entityType,
      entityId, diff: data, ip: clientIp(request),
    });

    const row = await prisma.seoMeta.findUnique({
      where: { entityType_entityId_locale: { entityType, entityId, locale } },
    });
    return json(row);
  },
);
