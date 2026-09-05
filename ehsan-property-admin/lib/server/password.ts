import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id, via @node-rs/argon2 rather than the `argon2` package the Fastify
 * API used. Both emit standard PHC strings, so hashes written by the old
 * server verify here unchanged -- confirmed against the seeded account. The
 * swap is for deployment: @node-rs ships prebuilt binaries instead of
 * compiling a native addon at install time.
 */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  return verify(storedHash, plain).catch(() => false);
}
