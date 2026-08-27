import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard/summary', { preHandler: requirePermission('project', 'read') }, async () => {
    const [
      seoBad, missingAlt, draftProjects, draftEvents, scheduledProjects, scheduledEvents,
      newEnquiries, recentEnquiries, upcomingEvents, recentActivity, lastPublish,
    ] = await Promise.all([
      prisma.seoMeta.findMany({
        where: { score: { lt: 50 } }, orderBy: { score: 'asc' }, take: 8,
      }),
      prisma.media.count({ where: { altText: null } }),
      prisma.project.count({ where: { publishState: 'DRAFT' } }),
      prisma.event.count({ where: { publishState: 'DRAFT' } }),
      prisma.project.count({ where: { publishState: 'SCHEDULED' } }),
      prisma.event.count({ where: { publishState: 'SCHEDULED' } }),
      prisma.enquiry.count({ where: { status: 'NEW' } }),
      prisma.enquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.event.findMany({
        where: { publishState: 'PUBLISHED', startsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' }, take: 3,
        include: { translations: { where: { locale: 'EN' } } },
      }),
      prisma.auditEntry.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { actor: { select: { name: true } } } }),
      prisma.auditEntry.findFirst({
        where: { action: { in: ['project.published', 'event.published'] } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const scheduledCount = scheduledProjects + scheduledEvents;

    // Titles for the low-scoring records, resolved separately -- SeoMeta is
    // polymorphic and cannot carry a Prisma include to its parent record.
    const seoWithTitles = await Promise.all(
      seoBad.map(async (s) => {
        const title =
          s.entityType === 'project'
            ? (await prisma.projectTranslation.findFirst({ where: { projectId: s.entityId, locale: s.locale } }))?.name
            : (await prisma.eventTranslation.findFirst({ where: { eventId: s.entityId, locale: s.locale } }))?.title;
        return { entityType: s.entityType, entityId: s.entityId, title: title ?? '(untitled)', score: s.score, band: s.band };
      }),
    );

    // 30-day enquiry trend, bucketed by day. Built in JS rather than a raw
    // SQL date_trunc -- Prisma's groupBy cannot bucket by day portably across
    // providers, and 30 rows is cheap to reduce client-side.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentForTrend = await prisma.enquiry.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
    const trend = new Map<string, number>();
    for (const e of recentForTrend) {
      const day = e.createdAt.toISOString().slice(0, 10);
      trend.set(day, (trend.get(day) ?? 0) + 1);
    }

    return {
      needsAttention: {
        lowScoring: seoWithTitles,
        mediaMissingAlt: missingAlt,
      },
      publishState: {
        draftProjects, draftEvents, scheduledCount,
        lastBuildAt: lastPublish?.createdAt ?? null,
      },
      enquiries: {
        unread: newEnquiries,
        recent: recentEnquiries,
        trend: [...trend.entries()].sort(([a], [b]) => a.localeCompare(b)),
      },
      upcomingEvents: upcomingEvents.map((e) => ({
        id: e.id, reference: e.reference, startsAt: e.startsAt,
        title: e.translations[0]?.title ?? '(untranslated)',
        capacity: e.capacity, registered: e.registered,
      })),
      activity: recentActivity.map((a) => ({
        id: a.id, action: a.action, entityType: a.entityType, entityId: a.entityId,
        actor: a.actor?.name ?? 'System', createdAt: a.createdAt,
      })),
      searchConsole: { enabled: false, reason: 'Not configured -- see build plan Phase 8.' },
    };
  });
}
