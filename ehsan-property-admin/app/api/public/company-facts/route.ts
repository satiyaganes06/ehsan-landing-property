import { buildProjectsPayload } from '@/lib/server/bridge';
import { readCompanyFacts } from '@/lib/server/company-facts';
import { renderCompanyFacts } from '@/lib/server/company-facts-render.mjs';
import { publicRoute } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const GET = publicRoute(async () => {
  const [profile, projects] = await Promise.all([readCompanyFacts(), buildProjectsPayload()]);
  return new Response(renderCompanyFacts(profile, projects), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } });
});
