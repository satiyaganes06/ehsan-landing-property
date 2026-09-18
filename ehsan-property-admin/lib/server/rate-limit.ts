import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from './prisma';

/**
 * Per-IP submission limit for the public enquiry form.
 *
 * The Fastify version used @fastify/rate-limit, which counts in memory -- fine
 * for one long-running process, useless across serverless invocations that
 * each start with an empty counter. The enquiry table already records a hashed
 * IP and a timestamp, so the rows themselves are the shared counter and a
 * contact form needs no Redis.
 */

/** The raw IP is never stored; only this truncated digest. */
export function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

const MAX_PER_WINDOW = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function enquiryRateLimited(ipHash: string | undefined): Promise<boolean> {
  if (!ipHash) return false; // nothing to attribute; the other defences still apply
  const since = new Date(Date.now() - WINDOW_MS);
  const recent = await prisma.enquiry.count({ where: { ipHash, createdAt: { gte: since } } });
  return recent >= MAX_PER_WINDOW;
}
