import type { FastifyReply } from 'fastify';
import type { AuthedUser } from './auth.js';

/**
 * The Contributor role's permission grant is flat ("project:update"), but
 * the plan restricts them to their OWN drafts -- a row-level rule the
 * resource:action matrix cannot express. Roles that outrank contributor
 * bypass the check entirely; a contributor editing someone else's row is
 * refused with the same 403 shape requirePermission() uses, so callers see
 * one consistent error contract regardless of which layer rejected them.
 */
export function canActOnOwnRecord(user: AuthedUser, createdById: string | null): boolean {
  if (user.roleKeys.some((k) => k !== 'contributor')) return true; // any non-contributor role present
  return createdById === user.id;
}

export function requireOwnership(user: AuthedUser, createdById: string | null, reply: FastifyReply): boolean {
  if (canActOnOwnRecord(user, createdById)) return true;
  reply.code(403).send({ error: 'forbidden', message: 'You can only edit records you created.' });
  return false;
}
