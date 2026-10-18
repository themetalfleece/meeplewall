import {
  COLLECTION_MAX_AGE_SECONDS,
  isOlderThan,
  isSyncAbandoned,
} from '@meeplewall/collection-sync';
import type { CollectionSync } from '@meeplewall/db';

import { IDLE_SYNC_STATUS, type SyncStatus } from './sync-status';

/**
 * The public view of a user's latest sync. The error text stays server-side. A sync no sync
 * worker picked up in time reads as failed, so polling stops and the next request restarts it.
 */
export function toSyncStatus({
  sync,
  now,
}: {
  sync: CollectionSync | undefined;
  now: Date;
}): SyncStatus {
  if (sync === undefined) {
    return IDLE_SYNC_STATUS;
  }

  return {
    state: isSyncAbandoned({ sync, now }) ? 'failed' : sync.status,
    startedAt: sync.startedAt.toISOString(),
    finishedAt: sync.finishedAt === null ? null : sync.finishedAt.toISOString(),
  };
}

/** True when a user has no stored collection, or the stored one is past its daily refresh. */
export function needsSync({ fetchedAt, now }: { fetchedAt: Date | undefined; now: Date }): boolean {
  if (fetchedAt === undefined) {
    return true;
  }

  return isOlderThan({ timestamp: fetchedAt, now, maxAgeSeconds: COLLECTION_MAX_AGE_SECONDS });
}
