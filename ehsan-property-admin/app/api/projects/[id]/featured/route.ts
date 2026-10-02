import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { route, json, clientIp, forbiddenOwnership } from '@/lib/server/route';
import { canActOnOwnRecord } from '@/lib/server/ownership';
import { recordAudit } from '@/lib/server/audit';
import { featuredProjectsKey, readFeaturedProjects } from '@/lib/server/featured-projects';

export const runtime = 'nodejs';
const bodySchema = z.object({ featured: z.boolean() });

export const PATCH = route<{ id: string }>({ resource: 'project', action: 'update' }, async ({ request, params, user }) => {
  const { featured } = bodySchema.parse(await request.json());
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(async tx => {
        const project = await tx.project.findUnique({ where: { id: params.id } });
        if (!project) return { error: 'not_found' as const };
        if (!canActOnOwnRecord(user, project.createdById)) return { error: 'ownership' as const };
        if (featured && project.publishState !== 'PUBLISHED') return { error: 'unpublished' as const };
        const current = await readFeaturedProjects(tx);
        const next = current.filter(reference => reference !== project.reference);
        if (featured) next.push(project.reference);
        if (next.length > 3) return { error: 'limit' as const };
        const block = await tx.textBlock.upsert({
          where: { key: featuredProjectsKey },
          create: { key: featuredProjectsKey, label: 'Homepage featured projects', group: 'project-featured', kind: 'list' },
          update: {},
        });
        await tx.textBlockTranslation.upsert({
          where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } },
          create: { textBlockId: block.id, locale: 'EN', value: next },
          update: { value: next },
        });
        return { references: next };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ('error' in result) {
        if (result.error === 'ownership') return forbiddenOwnership();
        const message = result.error === 'limit' ? 'Only three projects can be starred. Unstar one first.' : result.error === 'unpublished' ? 'Publish this project before starring it.' : 'Project not found.';
        return json({ error: result.error, message }, result.error === 'not_found' ? 404 : 409);
      }
      recordAudit({ actorId: user.id, action: 'project.featured', entityType: 'project', entityId: params.id, diff: { featured }, ip: clientIp(request) });
      return json(result);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code) && attempt < 2) continue;
      throw error;
    }
  }
  return json({ error: 'conflict', message: 'Another update occurred. Please try again.' }, 409);
});
