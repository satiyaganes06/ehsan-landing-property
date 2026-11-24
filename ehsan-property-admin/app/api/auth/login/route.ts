import { readBoundedJson } from '@/lib/server/bounded-json';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { verifyPassword } from '@/lib/server/password';
import { createSession, setSessionCookie } from '@/lib/server/auth';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';

const LoginBody = z.object({ email: z.string().email(), password: z.string().min(1) });

// Bound repeated password checks on this admin server, including unknown accounts.
const attempts = new Map<string, { count: number; until: number }>();
const windowMs = 60_000;
function allowAttempt(email: string) {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.until > now) break;
    attempts.delete(key);
  }
  const entry = attempts.get(email);
  if (entry) return ++entry.count <= 10;
  if (attempts.size >= 2048) return false;
  attempts.set(email, { count: 1, until: now + windowMs });
  return true;
}

export const POST = publicRoute(async ({ request }) => {
  if (request.headers.get('sec-fetch-site') === 'cross-site' ||
      request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ error: 'bad_request', message: 'Use the admin sign-in form.' }, 400);
  }
  const body = await readBoundedJson(request, 64 * 1024);
  if (!body.ok && body.status === 413) {
    return Response.json({ message: 'Request body too large.' }, { status: 413 });
  }
  const parsed = LoginBody.safeParse(body.ok ? body.value : null);
  if (!parsed.success) {
    return json({ error: 'bad_request', message: 'Enter a valid email and password.' }, 400);
  }

  const { email, password } = parsed.data;
  if (!allowAttempt(email.toLowerCase())) {
    return Response.json({ message: 'Too many attempts. Try again in a minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const user = await prisma.user.findUnique({ where: { email } });

  // The same generic message whether the email or the password was wrong --
  // distinguishing them tells an attacker which addresses are registered.
  const GENERIC = { error: 'invalid_credentials', message: 'Incorrect email or password.' };
  if (!user || !user.isActive) return json(GENERIC, 401);

  if (!(await verifyPassword(user.passwordHash, password))) {
    recordAudit({ actorId: user.id, action: 'login.failed', ip: clientIp(request) });
    return json(GENERIC, 401);
  }

  attempts.delete(email.toLowerCase());
  const token = await createSession(
    user.id,
    user.passwordHash,
    clientIp(request),
    request.headers.get('user-agent') ?? undefined,
  );
  if (!token) return json(GENERIC, 401);
  await setSessionCookie(token);
  recordAudit({ actorId: user.id, action: 'login', ip: clientIp(request) });

  return json({ id: user.id, email: user.email, name: user.name });
});
