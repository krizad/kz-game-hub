import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time secret comparison using SHA-256 digests so length mismatches
 * never leak timing information.
 */
export function timingSafeSecretEqual(candidate: unknown, secret: string | undefined): boolean {
  if (typeof candidate !== 'string' || !secret) return false;
  const candidateDigest = createHash('sha256').update(candidate, 'utf8').digest();
  const secretDigest = createHash('sha256').update(secret, 'utf8').digest();
  return timingSafeEqual(candidateDigest, secretDigest);
}
