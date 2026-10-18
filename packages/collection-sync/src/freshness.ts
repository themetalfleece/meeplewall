import type { CollectionSync } from '@meeplewall/db';

const MILLISECONDS_PER_SECOND = 1_000;

/** A stored collection older than this is synced again on the next visit. */
export const COLLECTION_MAX_AGE_SECONDS = 24 * 60 * 60;

/** A stored game older than this is fetched again when a sync next includes it. */
export const GAME_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** At most one sync may start per user in this window, manual refreshes included. */
export const SYNC_THROTTLE_SECONDS = 60;

/**
 * A sync still running after this long, with no worker holding it, is treated as
 * lost, for example because no sync worker is up. A large cold collection takes
 * several minutes at the BGG rate limit.
 */
export const SYNC_ABANDONED_AFTER_SECONDS = 60 * 60;

/** True when `timestamp` is more than `maxAgeSeconds` before `now`. */
export function isOlderThan({
  timestamp,
  now,
  maxAgeSeconds,
}: {
  timestamp: Date;
  now: Date;
  maxAgeSeconds: number;
}): boolean {
  return now.getTime() - timestamp.getTime() > maxAgeSeconds * MILLISECONDS_PER_SECOND;
}

/** True when a sync still marked running started too long ago to be alive and no worker holds it. */
export function isSyncAbandoned({
  sync,
  now,
}: {
  sync: Pick<CollectionSync, 'status' | 'startedAt' | 'lockedUntil'>;
  now: Date;
}): boolean {
  const leased = sync.lockedUntil !== null && sync.lockedUntil.getTime() > now.getTime();

  return (
    sync.status === 'running' &&
    !leased &&
    isOlderThan({ timestamp: sync.startedAt, now, maxAgeSeconds: SYNC_ABANDONED_AFTER_SECONDS })
  );
}

/**
 * Seconds until another sync may start for a user whose latest sync started at
 * `startedAt`, or 0 when one may start now.
 */
export function secondsUntilNextSync({ startedAt, now }: { startedAt: Date; now: Date }): number {
  const elapsedSeconds = (now.getTime() - startedAt.getTime()) / MILLISECONDS_PER_SECOND;

  return Math.max(0, Math.ceil(SYNC_THROTTLE_SECONDS - elapsedSeconds));
}
