import {
  getLatestCollectionSync,
  startCollectionSync,
  type CollectionSync,
  type DatabaseExecutor,
  type RefreshSource,
} from '@meeplewall/db';

import { SYNC_ABANDONED_AFTER_SECONDS, secondsUntilNextSync } from './freshness.ts';

/** What asking for a sync did. Only `started` queued a new one for the sync worker. */
export type SyncRequest =
  | { kind: 'started'; sync: CollectionSync }
  | { kind: 'joined'; sync: CollectionSync }
  | { kind: 'throttled'; sync: CollectionSync; retryAfterSeconds: number };

/**
 * Queues a sync for the sync worker, joins the one already running, or declines
 * when the user's latest sync started under `SYNC_THROTTLE_SECONDS` ago. Touches only the
 * database, so the web app can call it without a BGG client.
 */
export async function requestCollectionSync(
  database: DatabaseExecutor,
  { username, source, now = new Date() }: { username: string; source: RefreshSource; now?: Date },
): Promise<SyncRequest> {
  const latest = await getLatestCollectionSync(database, { username });
  if (latest !== undefined && latest.status !== 'running') {
    const retryAfterSeconds = secondsUntilNextSync({ startedAt: latest.startedAt, now });
    if (retryAfterSeconds > 0) {
      return { kind: 'throttled', sync: latest, retryAfterSeconds };
    }
  }

  const { sync, started } = await startCollectionSync(database, {
    username,
    source,
    staleAfterSeconds: SYNC_ABANDONED_AFTER_SECONDS,
  });

  return started ? { kind: 'started', sync } : { kind: 'joined', sync };
}
