import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

/** Site-wide health report — feeds the dashboard's needs-attention panel. */
export const GET = route({ resource: 'project', action: 'read' }, async () => {
  const rows = await prisma.seoMeta.findMany({
    where: { band: { not: 'GOOD' } },
    orderBy: { score: 'asc' },
  });

  const items = await Promise.all(
    rows.map(async (r) => {
      const title =
        r.entityType === 'project'
          ? (await prisma.projectTranslation.findFirst({ where: { projectId: r.entityId, locale: r.locale } }))?.name
          : (await prisma.eventTranslation.findFirst({ where: { eventId: r.entityId, locale: r.locale } }))?.title;
      return {
        entityType: r.entityType, entityId: r.entityId, locale: r.locale,
        title: title ?? '(untitled)', score: r.score, band: r.band,
      };
    }),
  );

  const counts = await prisma.seoMeta.groupBy({ by: ['band'], _count: true });
  return json({ counts: Object.fromEntries(counts.map((c) => [c.band, c._count])), items });
});
