import { readLicensing } from '@/lib/server/licensing';
import { publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';
export const GET = publicRoute(async () => {
  const data = await readLicensing();
  return Response.json({ ...data, records: data.records.filter(record => record.published) }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
});
