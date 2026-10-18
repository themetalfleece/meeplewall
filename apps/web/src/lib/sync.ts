import {
  COLLECTION_MAX_AGE_SECONDS,
  isOlderThan,
  isSyncAbandoned,
  type SyncRequest,
} from '@board-games/collection-sync';
import type { CollectionSync, RefreshSource } from '@board-games/db';
import { after } from 'next/server';

import { logError, logInfo } from './logger';
import { getSyncService } from './services';
import { IDLE_SYNC_STATUS, type SyncStatus } from './sync-status';

/**
 * The public view of a user's latest sync. The error text stays server-side. A sync abandoned
 * by a crashed process reads as failed, so polling stops and the next request restarts it.
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

/**
 * Runs a sync the request just started once the response has gone out, so neither the page nor
 * the route waits on BGG. A joined or throttled request has nothing to run.
 */
export function runStartedSyncAfterResponse({
  request,
  username,
  source,
}: {
  request: SyncRequest;
  username: string;
  source: RefreshSource;
}): void {
  if (request.kind !== 'started') {
    return;
  }
  const { sync } = request;

  after(async () => {
    try {
      const outcome = await getSyncService().runSync({ sync, username, source });
      if (outcome.status === 'failed') {
        logInfo({ message: 'Collection sync failed', fields: { username, error: outcome.error } });
      }
    } catch (error) {
      logError({ message: 'Collection sync crashed', error, fields: { username } });
    }
  });
}
