import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export const featuredProjectsKey = 'homepage.featured-projects';
const referencesSchema = z.array(z.string()).max(3);
const defaults = ['proj-15', 'proj-14', 'proj-12'];

export async function readFeaturedProjects(db: Prisma.TransactionClient = prisma) {
  const block = await db.textBlock.findUnique({
    where: { key: featuredProjectsKey },
    include: { translations: { where: { locale: 'EN' } } },
  });
  const parsed = referencesSchema.safeParse(block?.translations[0]?.value);
  const references = parsed.success ? parsed.data : defaults;
  const live = await db.project.findMany({ where: { reference: { in: references }, publishState: 'PUBLISHED' }, select: { reference: true } });
  return references.filter(reference => live.some(project => project.reference === reference));
}
