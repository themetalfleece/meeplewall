import { routes } from '@/lib/route-params';
import { syncStatusSchema, type SyncStatus } from '@/lib/sync-status';

import { POLL_INTERVAL_MS } from './SyncWatcher.constants';
import type { RefreshResult } from './SyncWatcher.types';

const DEFAULT_RETRY_AFTER_SECONDS = 60;

const updatedAtFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

async function readStatus(response: Response): Promise<SyncStatus> {
  const body: unknown = await response.json();

  return syncStatusSchema.parse(body);
}

/** Reads a user's sync status once. Rejects on a non-2xx answer or an unexpected body. */
export async function fetchSyncStatus({
  username,
  signal,
}: {
  username: string;
  signal: AbortSignal;
}): Promise<SyncStatus> {
  const response = await fetch(routes.syncStatus(username), { signal, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Sync status answered ${response.status}`);
  }

  return readStatus(response);
}

function retryAfterSeconds(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS;
}

/** Asks for a manual refresh. A 429 is a normal answer here, not an error. */
export async function requestRefresh({ username }: { username: string }): Promise<RefreshResult> {
  const response = await fetch(routes.refresh(username), { method: 'POST' });
  if (response.status === 429) {
    return {
      kind: 'throttled',
      status: await readStatus(response),
      retryAfterSeconds: retryAfterSeconds(response),
    };
  }
  if (!response.ok) {
    throw new Error(`Refresh answered ${response.status}`);
  }

  return { kind: 'accepted', status: await readStatus(response) };
}

/** The TanStack Query key for one user's sync status. */
export function syncStatusQueryKey(username: string): [string, string] {
  return ['sync-status', username];
}

/** Polls only while a sync runs. */
export function pollInterval(status: SyncStatus | undefined): number | false {
  return status?.state === 'running' ? POLL_INTERVAL_MS : false;
}

/** The status line above the grid. */
export function describeSync({
  status,
  fetchedAt,
}: {
  status: SyncStatus;
  fetchedAt: string | null;
}): string {
  if (status.state === 'running') {
    return fetchedAt === null
      ? 'Fetching this collection from BoardGameGeek. Large collections take a few minutes.'
      : 'Checking BoardGameGeek for changes.';
  }
  if (status.state === 'failed') {
    return "Couldn't fetch this collection from BoardGameGeek. Check the username, or try again in a minute.";
  }
  if (fetchedAt === null) {
    return 'This collection has not been fetched yet.';
  }

  return `Updated ${updatedAtFormat.format(new Date(fetchedAt))} UTC.`;
}
