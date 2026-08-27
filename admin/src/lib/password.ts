import argon2 from 'argon2';

// argon2id is the OWASP-recommended variant — resistant to both GPU cracking
// (argon2i's weakness) and side-channel attacks (argon2d's weakness).
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain).catch(() => false);
}
