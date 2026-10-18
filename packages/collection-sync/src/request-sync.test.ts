import { claimNextCollectionSync, finishCollectionSync, getCollectionSync } from '@meeplewall/db';
import { describe, expect, it } from 'vitest';

import { SYNC_THROTTLE_SECONDS } from './freshness.ts';
import { requestCollectionSync } from './request-sync.ts';
import { resolveTestServerUrl, useTestDatabase } from './testing/test-database.ts';

const serverUrl = await resolveTestServerUrl();

describe.skipIf(serverUrl === undefined)('requestCollectionSync', () => {
  const database = useTestDatabase(serverUrl);

  function request({ username, now }: { username: string; now: Date }) {
    return requestCollectionSync(database(), { username, source: 'user', now });
  }

  /** Requests a sync and finishes it with success, as a worker would. */
  async function requestAndFinish({ username, now }: { username: string; now: Date }) {
    const { sync } = await request({ username, now });
    await claimNextCollectionSync(database(), {
      workerId: 'test-worker',
      holdSeconds: 60,
      maxAttempts: 3,
    });
    await finishCollectionSync(database(), {
      syncId: sync.id,
      workerId: 'test-worker',
      outcome: { status: 'succeeded' },
    });
  }

  it('queues an unclaimed sync for a user seen for the first time', async () => {
    const started = await request({ username: 'alice', now: new Date() });

    expect(started.kind).toBe('started');
    expect(started.sync).toMatchObject({ status: 'running', source: 'user', lockedBy: null });
    expect(await getCollectionSync(database(), { syncId: started.sync.id })).toEqual(started.sync);
  });

  it('joins the sync already running', async () => {
    const first = await request({ username: 'alice', now: new Date() });

    const second = await request({ username: 'Alice', now: new Date() });

    expect(second).toEqual({ kind: 'joined', sync: first.sync });
  });

  it('declines a new sync within the throttle window after the last one finished', async () => {
    await requestAndFinish({ username: 'alice', now: new Date() });

    const throttled = await request({ username: 'alice', now: new Date() });

    expect(throttled.kind).toBe('throttled');
    expect(throttled.kind === 'throttled' && throttled.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('starts again once the throttle window has passed', async () => {
    await requestAndFinish({ username: 'alice', now: new Date() });
    const later = new Date(Date.now() + (SYNC_THROTTLE_SECONDS + 1) * 1_000);

    expect((await request({ username: 'alice', now: later })).kind).toBe('started');
  });
});
