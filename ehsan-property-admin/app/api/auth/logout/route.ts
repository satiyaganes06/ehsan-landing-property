import { clearSessionCookie, destroySession, readSessionToken } from '@/lib/server/auth';
import { json, publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';

export const POST = publicRoute(async () => {
  const token = await readSessionToken();
  if (token) await destroySession(token);
  await clearSessionCookie();
  return json({ ok: true });
});
