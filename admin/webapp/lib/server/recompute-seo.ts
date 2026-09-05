import { prisma } from './prisma';
import { evaluateSeo } from './seo-score';

export interface SeoInput {
  entityType: 'project' | 'event';
  entityId: string;
  locale: 'EN' | 'MS';
  bodyText: string;
  imageCount: number;
  imagesWithAlt: number;
  internalLinkCount: number;
}

/**
 * Called after every content save. Reads the meta fields already stored on
 * seo_meta (title/description/slug/keyword -- editable independently of the
 * body) and re-derives score against the LATEST body content, so editing a
 * description updates the score even when the meta title itself did not
 * change.
 */
export async function recomputeSeo(input: SeoInput): Promise<void> {
  const existing = await prisma.seoMeta.findUnique({
    where: { entityType_entityId_locale: { entityType: input.entityType, entityId: input.entityId, locale: input.locale } },
  });

  const otherTitles = await prisma.seoMeta.findMany({
    where: { entityType: input.entityType, locale: input.locale, entityId: { not: input.entityId }, metaTitle: { not: null } },
    select: { metaTitle: true },
  });

  const title = existing?.metaTitle ?? '';
  const description = existing?.metaDescription ?? '';
  const slug =
    input.entityType === 'project'
      ? (await prisma.projectTranslation.findFirst({ where: { projectId: input.entityId, locale: input.locale } }))?.slug
      : (await prisma.eventTranslation.findFirst({ where: { eventId: input.entityId, locale: input.locale } }))?.slug;

  const result = evaluateSeo({
    title, description, slug: slug ?? '', focusKeyword: existing?.focusKeyword ?? null,
    bodyText: input.bodyText, imageCount: input.imageCount, imagesWithAlt: input.imagesWithAlt,
    otherPublishedTitles: otherTitles.map((t) => t.metaTitle!).filter(Boolean),
    internalLinkCount: input.internalLinkCount,
  });

  await prisma.seoMeta.upsert({
    where: { entityType_entityId_locale: { entityType: input.entityType, entityId: input.entityId, locale: input.locale } },
    create: {
      entityType: input.entityType, entityId: input.entityId, locale: input.locale,
      score: result.score, band: result.band, scoreDetail: result.rules as any, scoredAt: new Date(),
    },
    update: { score: result.score, band: result.band, scoreDetail: result.rules as any, scoredAt: new Date() },
  });
}
