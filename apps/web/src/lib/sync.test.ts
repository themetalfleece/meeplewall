import { SYNC_ABANDONED_AFTER_SECONDS, type SyncRequest } from '@meeplewall/collection-sync';
import type { CollectionSync } from '@meeplewall/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IDLE_SYNC_STATUS, syncStatusSchema } from './sync-status';

const { after, runSync } = vi.hoisted(() => ({
  after: vi.fn<(task: () => Promise<void>) => void>(),
  runSync: vi.fn(),
}));

vi.mock('next/server', () => ({ after }));
vi.mock('./services', () => ({ getSyncService: () => ({ runSync }) }));

const { needsSync, runStartedSyncAfterResponse, toSyncStatus } = await import('./sync');

const NOW = new Date('2026-10-18T12:00:00.000Z');
const SYNC: CollectionSync = {
  id: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  status: 'running',
  error: null,
  startedAt: NOW,
  finishedAt: null,
};

function hoursBefore(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000);
}

/** Runs whatever was handed to `after`, as Next.js would once the response is sent. */
async function runDeferredTask() {
  const [task] = after.mock.calls[0] ?? [];
  if (task === undefined) {
    throw new Error('Nothing was deferred');
  }
  await task();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('needsSync', () => {
  it('syncs a user with no stored collection', () => {
    expect(needsSync({ fetchedAt: undefined, now: NOW })).toBe(true);
  });

  it('keeps a collection fetched within the day', () => {
    expect(needsSync({ fetchedAt: hoursBefore(23), now: NOW })).toBe(false);
  });

  it('syncs a collection older than a day', () => {
    expect(needsSync({ fetchedAt: hoursBefore(25), now: NOW })).toBe(true);
  });
});

describe('toSyncStatus', () => {
  const later = new Date(NOW.getTime() + 5 * 60_000);

  it('is idle for a user that never synced', () => {
    expect(toSyncStatus({ sync: undefined, now: NOW })).toEqual(IDLE_SYNC_STATUS);
  });

  it('reports a running sync with its start time', () => {
    expect(toSyncStatus({ sync: SYNC, now: later })).toEqual({
      state: 'running',
      startedAt: '2026-10-18T12:00:00.000Z',
      finishedAt: null,
    });
  });

  it('reports a sync still running past the abandoned window as failed', () => {
    const now = new Date(NOW.getTime() + (SYNC_ABANDONED_AFTER_SECONDS + 1) * 1_000);

    expect(toSyncStatus({ sync: SYNC, now })).toEqual({
      state: 'failed',
      startedAt: '2026-10-18T12:00:00.000Z',
      finishedAt: null,
    });
  });

  it('reports a failed sync without its error text', () => {
    const status = toSyncStatus({
      sync: {
        ...SYNC,
        status: 'failed',
        error: 'BGG answered 401 for https://boardgamegeek.com/xmlapi2/collection',
        finishedAt: new Date('2026-10-18T12:01:00.000Z'),
      },
      now: later,
    });

    expect(status).toEqual({
      state: 'failed',
      startedAt: '2026-10-18T12:00:00.000Z',
      finishedAt: '2026-10-18T12:01:00.000Z',
    });
    expect(JSON.stringify(status)).not.toContain('401');
  });

  it('produces what the schema accepts', () => {
    const status = toSyncStatus({
      sync: { ...SYNC, status: 'succeeded', finishedAt: later },
      now: later,
    });

    expect(syncStatusSchema.parse(status)).toMatchObject({ state: 'succeeded' });
  });
});

describe('runStartedSyncAfterResponse', () => {
  it.each<SyncRequest>([
    { kind: 'joined', sync: SYNC },
    { kind: 'throttled', sync: SYNC, retryAfterSeconds: 30 },
  ])('defers nothing for a $kind request', (request) => {
    runStartedSyncAfterResponse({ request, username: 'alice', source: 'api' });

    expect(after).not.toHaveBeenCalled();
  });

  it('runs a started sync after the response', async () => {
    runSync.mockResolvedValue({ status: 'succeeded' });

    runStartedSyncAfterResponse({
      request: { kind: 'started', sync: SYNC },
      username: 'alice',
      source: 'user',
    });

    expect(runSync).not.toHaveBeenCalled();
    await runDeferredTask();
    expect(runSync).toHaveBeenCalledWith({ sync: SYNC, username: 'alice', source: 'user' });
  });

  it('logs a failed outcome', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    runSync.mockResolvedValue({ status: 'failed', error: 'BGG answered 500' });

    runStartedSyncAfterResponse({
      request: { kind: 'started', sync: SYNC },
      username: 'alice',
      source: 'api',
    });
    await runDeferredTask();

    expect(String(log.mock.calls[0]?.[0])).toContain('BGG answered 500');
  });

  it('logs a crash instead of rejecting', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    runSync.mockRejectedValue(new Error('pool closed'));

    runStartedSyncAfterResponse({
      request: { kind: 'started', sync: SYNC },
      username: 'alice',
      source: 'api',
    });

    await expect(runDeferredTask()).resolves.toBeUndefined();
    expect(String(error.mock.calls[0]?.[0])).toContain('pool closed');
  });
});
