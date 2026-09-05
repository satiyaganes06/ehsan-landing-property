import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

export const COOKIE_NAME = 'ehsan_session';
const SESSION_DAYS = 14;

/**
 * The cookie carries a random opaque token; only its SHA-256 hash is stored.
 * A leaked database row then does not itself hand out a working session --
 * the same reasoning as storing a password hash rather than the password.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  roleKeys: string[];
  /** "resource:action" */
  permissions: Set<string>;
}

export async function createSession(
  userId: string,
  ip: string | undefined,
  userAgent: string | undefined,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt, ip, userAgent },
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  // Logout is idempotent: a token that is already gone is still logged out.
  await prisma.session.delete({ where: { id: hashToken(token) } }).catch(() => {});
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: COOKIE_NAME, path: '/' });
}

export async function readSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value;
}

/**
 * Loads the user plus a flattened permission set for the token in the request
 * cookie. Returns null for no cookie, an expired session, or a deactivated
 * user -- the caller does not need to tell those apart.
 *
 * In Fastify this ran once per request as an `onRequest` hook that decorated
 * `req.user`. Next has no equivalent seam that route handlers can share, so
 * it is called from the `route()` wrapper instead: same single call site, same
 * once-per-request cost.
 */
export async function loadAuthedUser(): Promise<AuthedUser | null> {
  const token = await readSessionToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: {
      user: {
        include: {
          roles: {
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;

  const permissions = new Set<string>();
  const roleKeys: string[] = [];
  for (const ur of session.user.roles) {
    roleKeys.push(ur.role.key);
    for (const rp of ur.role.permissions) {
      permissions.add(`${rp.permission.resource}:${rp.permission.action}`);
    }
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roleKeys,
    permissions,
  };
}
