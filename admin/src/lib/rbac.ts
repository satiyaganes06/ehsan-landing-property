import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthedUser } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthedUser | null;
  }
}

/**
 * Fastify signals hook completion one of two ways: the hook calls the `done`
 * callback it is handed as a third argument, or it returns a promise the
 * framework can await. A hook that takes only (req, reply) and returns
 * undefined does neither, and the hook chain simply never advances -- the
 * request hangs until the client times out.
 *
 * These guards are therefore async. Once the returned promise settles Fastify
 * checks reply.sent, so sending a 401/403 and returning is enough to stop the
 * route handler from running; throwing after send() would only add an
 * "already sent" warning to every rejected request.
 */
export function requirePermission(resource: string, action: string) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      reply.code(401).send({ error: 'unauthenticated', message: 'Sign in required.' });
      return;
    }
    if (!req.user.permissions.has(`${resource}:${action}`)) {
      reply.code(403).send({ error: 'forbidden', message: `Your role cannot ${action} ${resource}.` });
      return;
    }
  };
}

/** For handlers that need the user narrowed to non-null without a separate
    preHandler -- e.g. routes gated by ownership rather than a flat
    permission. Call at the top of the handler, before touching req.user. */
export function requireAuth(req: FastifyRequest, reply: FastifyReply): req is FastifyRequest & { user: AuthedUser } {
  if (!req.user) {
    reply.code(401).send({ error: 'unauthenticated', message: 'Sign in required.' });
    return false;
  }
  return true;
}
