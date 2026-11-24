import 'server-only';
import type { AuthedUser } from './auth';

/**
 * The Contributor role's grant is flat ("project:update"), but contributors
 * may only edit their OWN records -- a row-level rule the resource:action
 * matrix cannot express. Any higher role bypasses the check entirely.
 */
export function canActOnOwnRecord(user: AuthedUser, createdById: string | null): boolean {
  if (user.roleKeys.some((key) => ['owner', 'admin', 'editor'].includes(key))) return true;
  return createdById === user.id;
}
