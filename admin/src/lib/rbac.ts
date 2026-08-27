import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthedUser } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthedUser | null;
  }
}

/**
 * Fastify preHandler hooks that call reply.send() do not need to throw to
 * stop the chain -- the framework checks reply.sent before running the next
 * hook or the route handler. Throwing after send() is worse than a no-op: it
 * logs an "already sent" warning on every rejected request. So every guard
 * here just sends and returns.
 */
export function requirePermission(resource: string, action: string) {
  return (req: FastifyRequest, reply: FastifyReply): void => {
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
