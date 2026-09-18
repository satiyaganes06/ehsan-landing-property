import 'server-only';
import { prisma } from './prisma';

/**
 * Gathers the content signals the score engine grades: how much body copy
 * exists, how many images carry alt text, how many internal links point out.
 * Shared by the SEO write route and the publish paths so a score never
 * depends on which endpoint recomputed it.
 */
export async function scoringInputFor(
  entityType: 'project' | 'event',
  entityId: string,
  locale: 'EN' | 'MS',
) {
  if (entityType === 'project') {
    const [t, media, project] = await Promise.all([
      prisma.projectTranslation.findUnique({ where: { projectId_locale: { projectId: entityId, locale } } }),
      prisma.projectMedia.findMany({ where: { projectId: entityId }, include: { media: true } }),
      prisma.project.findUnique({ where: { id: entityId } }),
    ]);
    return {
      bodyText: t?.description ?? '',
      imageCount: media.length,
      imagesWithAlt: media.filter((m) => Boolean(m.media.altText)).length,
      internalLinkCount: ((project?.relatedReferences as string[]) ?? []).length,
    };
  }

  const [t, event] = await Promise.all([
    prisma.eventTranslation.findUnique({ where: { eventId_locale: { eventId: entityId, locale } } }),
    prisma.event.findUnique({ where: { id: entityId } }),
  ]);
  let imagesWithAlt = 0;
  if (event?.heroMediaId) {
    const media = await prisma.media.findUnique({ where: { id: event.heroMediaId } });
    if (media?.altText) imagesWithAlt = 1;
  }
  return {
    bodyText: t?.description ?? '',
    imageCount: event?.heroMediaId || event?.heroImageUrl ? 1 : 0,
    imagesWithAlt,
    internalLinkCount: ((event?.relatedReferences as string[]) ?? []).length,
  };
}
