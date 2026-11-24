import { clearSessionCookie, destroySession, readSessionToken } from '@/lib/server/auth';
import { json, publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';

export const POST = publicRoute(async ({ request }) => {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return json({ error: 'forbidden', message: 'Use the admin panel to sign out.' }, 403);
  }
  const token = await readSessionToken();
  if (token) await destroySession(token);
  await clearSessionCookie();
  return json({ ok: true });
});
