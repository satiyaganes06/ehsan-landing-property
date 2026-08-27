import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { verifyPassword } from '../../lib/password.js';
import { createSession, destroySession, setSessionCookie, clearSessionCookie } from '../../lib/auth.js';
import { recordAudit } from '../../lib/audit.js';
import { clientIp } from '../../lib/http.js';

const LoginBody = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', message: 'Enter a valid email and password.' });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // Same generic message whether the email or the password was wrong --
    // distinguishing them tells an attacker which emails are registered.
    const GENERIC = { error: 'invalid_credentials', message: 'Incorrect email or password.' };
    if (!user || !user.isActive) return reply.code(401).send(GENERIC);

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      recordAudit({ actorId: user.id, action: 'login.failed', ip: clientIp(req) });
      return reply.code(401).send(GENERIC);
    }

    const token = await createSession(user.id, clientIp(req), req.headers['user-agent']);
    setSessionCookie(reply, token);
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    recordAudit({ actorId: user.id, action: 'login', ip: clientIp(req) });

    return reply.send({ id: user.id, email: user.email, name: user.name });
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies['ehsan_session'];
    if (token) await destroySession(token);
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });

  app.get('/api/auth/me', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthenticated' });
    return reply.send({
      id: req.user.id, email: req.user.email, name: req.user.name,
      roles: req.user.roleKeys, permissions: [...req.user.permissions],
    });
  });
}
