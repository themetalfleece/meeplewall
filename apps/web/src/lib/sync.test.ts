import { SYNC_ABANDONED_AFTER_SECONDS } from '@meeplewall/collection-sync';
import type { CollectionSync } from '@meeplewall/db';
import { describe, expect, it } from 'vitest';

import { needsSync, toSyncStatus } from './sync';
import { IDLE_SYNC_STATUS, syncStatusSchema } from './sync-status';

const NOW = new Date('2026-10-18T12:00:00.000Z');
const SYNC: CollectionSync = {
  id: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  status: 'running',
  source: 'api',
  error: null,
  attempts: 0,
  lockedBy: null,
  lockedUntil: null,
  startedAt: NOW,
  finishedAt: null,
};

function hoursBefore(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000);
}

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

  it('reports a sync no worker picked up within the abandoned window as failed', () => {
    const now = new Date(NOW.getTime() + (SYNC_ABANDONED_AFTER_SECONDS + 1) * 1_000);

    expect(toSyncStatus({ sync: SYNC, now })).toEqual({
      state: 'failed',
      startedAt: '2026-10-18T12:00:00.000Z',
      finishedAt: null,
    });
  });

  it('keeps reporting a long sync as running while a worker holds its lease', () => {
    const now = new Date(NOW.getTime() + (SYNC_ABANDONED_AFTER_SECONDS + 1) * 1_000);
    const leased = { ...SYNC, lockedBy: 'worker', lockedUntil: new Date(now.getTime() + 30_000) };

    expect(toSyncStatus({ sync: leased, now }).state).toBe('running');
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
