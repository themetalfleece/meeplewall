import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SyncStatus } from '@/lib/sync-status';

import { POLL_INTERVAL_MS } from './SyncWatcher.constants';
import {
  describeSync,
  fetchSyncStatus,
  pollInterval,
  requestRefresh,
  syncStatusQueryKey,
} from './SyncWatcher.data';

const RUNNING: SyncStatus = {
  state: 'running',
  startedAt: '2026-10-18T10:00:00.000Z',
  finishedAt: null,
};
const SUCCEEDED: SyncStatus = {
  ...RUNNING,
  state: 'succeeded',
  finishedAt: '2026-10-18T10:02:00.000Z',
};
const FAILED: SyncStatus = { ...SUCCEEDED, state: 'failed' };

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), init);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchSyncStatus', () => {
  it('reads the status route with the caller signal and parses the body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(RUNNING));
    const signal = new AbortController().signal;

    expect(await fetchSyncStatus({ username: 'first last', signal })).toEqual(RUNNING);
    expect(fetchSpy).toHaveBeenCalledWith('/api/sync/first%20last', {
      signal,
      cache: 'no-store',
    });
  });

  it('rejects a non-2xx answer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({}, { status: 500 }));

    await expect(
      fetchSyncStatus({ username: 'alice', signal: new AbortController().signal }),
    ).rejects.toThrow('Sync status answered 500');
  });

  it('rejects a body that is not a status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ state: 'paused' }));

    await expect(
      fetchSyncStatus({ username: 'alice', signal: new AbortController().signal }),
    ).rejects.toThrow();
  });
});

describe('requestRefresh', () => {
  it('posts to the refresh route and returns the accepted status', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(RUNNING, { status: 202 }));

    expect(await requestRefresh({ username: 'alice' })).toEqual({
      kind: 'accepted',
      status: RUNNING,
    });
    expect(fetchSpy).toHaveBeenCalledWith('/api/refresh/alice', { method: 'POST' });
  });

  it('reports a throttled refresh with its Retry-After', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(SUCCEEDED, { status: 429, headers: { 'retry-after': '42' } }),
    );

    expect(await requestRefresh({ username: 'alice' })).toEqual({
      kind: 'throttled',
      status: SUCCEEDED,
      retryAfterSeconds: 42,
    });
  });

  it('falls back to a minute when Retry-After is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(SUCCEEDED, { status: 429 }));

    expect(await requestRefresh({ username: 'alice' })).toMatchObject({ retryAfterSeconds: 60 });
  });

  it('rejects any other failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({}, { status: 503 }));

    await expect(requestRefresh({ username: 'alice' })).rejects.toThrow('Refresh answered 503');
  });
});

describe('syncStatusQueryKey', () => {
  it('keys each user apart', () => {
    expect(syncStatusQueryKey('alice')).toEqual(['sync-status', 'alice']);
    expect(syncStatusQueryKey('alice')).not.toEqual(syncStatusQueryKey('bob'));
  });
});

describe('pollInterval', () => {
  it('polls while a sync runs', () => {
    expect(pollInterval(RUNNING)).toBe(POLL_INTERVAL_MS);
  });

  it.each([SUCCEEDED, FAILED, undefined])('stops otherwise (%j)', (status) => {
    expect(pollInterval(status)).toBe(false);
  });
});

describe('describeSync', () => {
  it('explains a first fetch', () => {
    expect(describeSync({ status: RUNNING, fetchedAt: null })).toMatch(/^Fetching this collection/);
  });

  it('explains a refresh of a stored collection', () => {
    expect(describeSync({ status: RUNNING, fetchedAt: SUCCEEDED.finishedAt })).toMatch(
      /^Checking BoardGameGeek/,
    );
  });

  it('explains a failure', () => {
    expect(describeSync({ status: FAILED, fetchedAt: null })).toMatch(/^Couldn't fetch/);
  });

  it('shows when the stored collection was fetched, in UTC', () => {
    expect(describeSync({ status: SUCCEEDED, fetchedAt: '2026-10-18T10:02:00.000Z' })).toBe(
      'Updated 18 Oct 2026, 10:02 UTC.',
    );
  });

  it('says so when nothing was ever fetched', () => {
    expect(
      describeSync({
        status: { state: 'idle', startedAt: null, finishedAt: null },
        fetchedAt: null,
      }),
    ).toBe('This collection has not been fetched yet.');
  });
});
