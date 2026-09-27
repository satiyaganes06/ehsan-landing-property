import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';
export const GET = route({ auth: true }, async ({ request }) => {
  const requested = Number(request.nextUrl.searchParams.get('days') || 30);
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  // Reports use the business's timezone, not the browser or server's timezone.
  const now = Date.now();
  const today = new Date(now + 8 * 3600_000).toISOString().slice(0, 10);
  const todayStart = new Date(`${today}T00:00:00+08:00`);
  const since = new Date(todayStart.getTime() - (days - 1) * 86400_000);
  const previousStart = new Date(since.getTime() - days * 86400_000);
  const [rows, previousViews, firstView, enquiries] = await Promise.all([
    prisma.pageView.findMany({ where: { createdAt: { gte: since } }, select: { sessionId: true, path: true, source: true, device: true, createdAt: true } }),
    prisma.pageView.count({ where: { createdAt: { gte: previousStart, lt: since } } }),
    prisma.pageView.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.enquiry.count({ where: { createdAt: { gte: since } } }),
  ]);
  const visitors = new Set<string>();
  const todayVisitors = new Set<string>();
  const daily = new Map<string, { views: number; visitors: Set<string> }>();
  const pages = new Map<string, number>(); const sources = new Map<string, number>(); const devices = new Map<string, number>();
  for (let index = 0; index < days; index++) daily.set(new Date(since.getTime() + index * 86400_000 + 8 * 3600_000).toISOString().slice(0, 10), { views: 0, visitors: new Set() });
  for (const row of rows) {
    visitors.add(row.sessionId);
    if (row.createdAt >= todayStart) todayVisitors.add(row.sessionId);
    const date = new Date(row.createdAt.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
    const bucket = daily.get(date); if (bucket) { bucket.views++; bucket.visitors.add(row.sessionId); }
    pages.set(row.path, (pages.get(row.path) || 0) + 1); sources.set(row.source || 'Direct', (sources.get(row.source || 'Direct') || 0) + 1); devices.set(row.device, (devices.get(row.device) || 0) + 1);
  }
  const rank = (map: Map<string, number>) => [...map].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count }));
  return json({ days, pageViews: rows.length, visitors: visitors.size, todayVisitors: todayVisitors.size, enquiries, previousViews, change: previousViews ? Math.round((rows.length - previousViews) / previousViews * 100) : null, trackingSince: firstView?.createdAt ?? null, daily: [...daily].map(([date, bucket]) => ({ date, views: bucket.views, visitors: bucket.visitors.size })), pages: rank(pages), sources: rank(sources), devices: rank(devices) });
});
