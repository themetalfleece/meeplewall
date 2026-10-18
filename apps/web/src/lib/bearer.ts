import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * True when an `Authorization` header carries exactly `Bearer <secret>`. Compares digests in
 * constant time, so neither the secret nor its length leaks through timing.
 */
export function hasBearerSecret({
  authorization,
  secret,
}: {
  authorization: string | null;
  secret: string;
}): boolean {
  if (authorization === null || !authorization.startsWith('Bearer ')) {
    return false;
  }

  return timingSafeEqual(digest(authorization.slice('Bearer '.length)), digest(secret));
}
