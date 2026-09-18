import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { verifyPassword } from '@/lib/server/password';
import { createSession, setSessionCookie } from '@/lib/server/auth';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';

const LoginBody = z.object({ email: z.string().email(), password: z.string().min(1) });

export const POST = publicRoute(async ({ request }) => {
  const parsed = LoginBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: 'bad_request', message: 'Enter a valid email and password.' }, 400);
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // The same generic message whether the email or the password was wrong --
  // distinguishing them tells an attacker which addresses are registered.
  const GENERIC = { error: 'invalid_credentials', message: 'Incorrect email or password.' };
  if (!user || !user.isActive) return json(GENERIC, 401);

  if (!(await verifyPassword(user.passwordHash, password))) {
    recordAudit({ actorId: user.id, action: 'login.failed', ip: clientIp(request) });
    return json(GENERIC, 401);
  }

  const token = await createSession(
    user.id,
    clientIp(request),
    request.headers.get('user-agent') ?? undefined,
  );
  await setSessionCookie(token);
  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  recordAudit({ actorId: user.id, action: 'login', ip: clientIp(request) });

  return json({ id: user.id, email: user.email, name: user.name });
});
