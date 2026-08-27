import { randomBytes, createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './prisma.js';

const COOKIE_NAME = 'ehsan_session';
const SESSION_DAYS = 14;

// The cookie carries a random opaque token; only its SHA-256 hash is stored.
// A leaked database row then does not itself hand out a working session --
// the same reasoning as storing a password hash rather than the password.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  roleKeys: string[];
  permissions: Set<string>; // "resource:action"
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
  await prisma.session.delete({ where: { id: hashToken(token) } }).catch(() => {
    // already gone — logout is idempotent
  });
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Loads the user + flattened permission set for the token in the request
    cookie. Returns null for no cookie, expired session, or deactivated user --
    the caller does not need to distinguish those cases. */
export async function loadAuthedUser(req: FastifyRequest): Promise<AuthedUser | null> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: {
      user: {
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
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

  return { id: session.user.id, email: session.user.email, name: session.user.name, roleKeys, permissions };
}
