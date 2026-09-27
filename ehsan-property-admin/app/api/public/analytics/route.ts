import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';
const origins = new Set((process.env.ANALYTICS_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:8899,http://127.0.0.1:8899').split(',').map(value => value.trim()));
const bodySchema = z.object({ sessionId: z.string().uuid(), path: z.string().min(1).max(500).regex(/^\/[a-zA-Z0-9_./%-]*$/), source: z.string().max(200).regex(/^[a-zA-Z0-9.:-]*$/), device: z.enum(['Mobile', 'Tablet', 'Desktop']) });
function headers(origin: string) { return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin', 'Cache-Control': 'no-store' }; }
export const OPTIONS = publicRoute(async ({ request }) => {
  const origin = request.headers.get('origin') || '';
  return new Response(null, { status: origins.has(origin) ? 204 : 403, headers: origins.has(origin) ? headers(origin) : {} });
});
export const POST = publicRoute(async ({ request }) => {
  const origin = request.headers.get('origin') || '';
  if (!origins.has(origin)) return new Response(null, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'Invalid page view.' }, { status: 400, headers: headers(origin) });
  if (/bot|crawler|spider|headless/i.test(request.headers.get('user-agent') || '')) return new Response(null, { status: 204, headers: headers(origin) });
  const since = new Date(Date.now() - 60_000);
  const recent = await prisma.pageView.count({ where: { sessionId: parsed.data.sessionId, createdAt: { gte: since } } });
  if (recent >= 20) return new Response(null, { status: 429, headers: headers(origin) });
  await prisma.pageView.create({ data: { ...parsed.data, path: parsed.data.path === '/index.html' ? '/' : parsed.data.path } });
  return new Response(null, { status: 204, headers: headers(origin) });
});
