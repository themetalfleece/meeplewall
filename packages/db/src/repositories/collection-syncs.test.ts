import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { resolveTestServerUrl, useTestDatabase } from '../dev/test-database.ts';
import { collectionSyncs } from '../schema/index.ts';
import {
  claimNextCollectionSync,
  finishCollectionSync,
  getCollectionSync,
  getLatestCollectionSync,
  renewCollectionSyncLease,
  startCollectionSync,
} from './collection-syncs.ts';
import { ensureUser, findUser } from './users.ts';

const serverUrl = await resolveTestServerUrl();

const STALE_AFTER_SECONDS = 600;
const HOLD_SECONDS = 60;
const MAX_ATTEMPTS = 3;
const WORKER = 'worker-a';

describe.skipIf(serverUrl === undefined)('collection syncs', () => {
  const database = useTestDatabase(serverUrl);

  function start(username: string) {
    return startCollectionSync(database(), {
      username,
      source: 'api',
      staleAfterSeconds: STALE_AFTER_SECONDS,
    });
  }

  function claim(workerId = WORKER) {
    return claimNextCollectionSync(database(), {
      workerId,
      holdSeconds: HOLD_SECONDS,
      maxAttempts: MAX_ATTEMPTS,
    });
  }

  async function claimAndFinish(syncId: string) {
    const claimed = await claim();
    expect(claimed?.sync.id).toBe(syncId);

    return finishCollectionSync(database(), {
      syncId,
      workerId: WORKER,
      outcome: { status: 'succeeded' },
    });
  }

  async function backdate({ syncId, seconds }: { syncId: string; seconds: number }) {
    await database()
      .update(collectionSyncs)
      .set({ startedAt: sql`now() - make_interval(secs => ${seconds})` })
      .where(eq(collectionSyncs.id, syncId));
  }

  async function expireLease(syncId: string) {
    await database()
      .update(collectionSyncs)
      .set({ lockedUntil: sql`now() - interval '1 second'` })
      .where(eq(collectionSyncs.id, syncId));
  }

  describe('startCollectionSync', () => {
    it('creates the user and an unclaimed running sync on first visit', async () => {
      const { sync, started } = await start('alice');

      expect(started).toBe(true);
      expect(sync).toMatchObject({
        status: 'running',
        source: 'api',
        error: null,
        attempts: 0,
        lockedBy: null,
        lockedUntil: null,
        finishedAt: null,
      });
      expect((await findUser(database(), { username: 'alice' }))?.id).toBe(sync.userId);
    });

    it('records where the sync was asked for', async () => {
      const { sync } = await startCollectionSync(database(), {
        username: 'alice',
        source: 'user',
        staleAfterSeconds: STALE_AFTER_SECONDS,
      });

      expect(sync.source).toBe('user');
    });

    it('joins the running sync instead of starting a second one', async () => {
      const first = await start('alice');

      const second = await start('ALICE');

      expect(second).toEqual({ sync: first.sync, started: false });
    });

    it('starts exactly one sync for concurrent first visits', async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => start('racer')));

      expect(results.filter(({ started }) => started)).toHaveLength(1);
      expect(new Set(results.map(({ sync }) => sync.id)).size).toBe(1);
    });

    it('starts a new sync once the previous one finished', async () => {
      const first = await start('alice');
      await claimAndFinish(first.sync.id);

      const second = await start('alice');

      expect(second.started).toBe(true);
      expect(second.sync.id).not.toBe(first.sync.id);
    });

    it('fails an abandoned sync no worker holds and starts a fresh one', async () => {
      const abandoned = await start('alice');
      await backdate({ syncId: abandoned.sync.id, seconds: STALE_AFTER_SECONDS + 1 });

      const fresh = await start('alice');

      expect(fresh.started).toBe(true);
      expect(await getCollectionSync(database(), { syncId: abandoned.sync.id })).toMatchObject({
        status: 'failed',
        error: 'Abandoned while running',
      });
    });

    it('joins an old sync while a worker still holds its lease', async () => {
      const slow = await start('alice');
      await claim();
      await backdate({ syncId: slow.sync.id, seconds: STALE_AFTER_SECONDS + 1 });

      const again = await start('alice');

      expect(again.started).toBe(false);
      expect(again.sync.id).toBe(slow.sync.id);
    });
  });

  describe('claimNextCollectionSync', () => {
    it('returns undefined when nothing is waiting', async () => {
      expect(await claim()).toBeUndefined();
    });

    it('leases the oldest waiting sync with the username to fetch', async () => {
      const older = await start('Alice');
      await backdate({ syncId: older.sync.id, seconds: 30 });
      await start('bob');

      const claimed = await claim();

      expect(claimed?.username).toBe('Alice');
      expect(claimed?.sync).toMatchObject({
        id: older.sync.id,
        status: 'running',
        attempts: 1,
        lockedBy: WORKER,
      });
      expect(claimed?.sync.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    });

    it('never hands a held sync to a second worker', async () => {
      await start('alice');
      await claim();

      expect(await claim('worker-b')).toBeUndefined();
    });

    it('gives concurrent workers different syncs', async () => {
      await Promise.all(['alice', 'bob', 'carol'].map((username) => start(username)));

      const claims = await Promise.all(['a', 'b', 'c'].map((workerId) => claim(workerId)));

      expect(new Set(claims.map((claimed) => claimed?.sync.id)).size).toBe(3);
    });

    it('takes over a sync whose lease ran out', async () => {
      const { sync } = await start('alice');
      await claim();
      await expireLease(sync.id);

      const takeover = await claim('worker-b');

      expect(takeover?.sync).toMatchObject({ id: sync.id, attempts: 2, lockedBy: 'worker-b' });
    });

    it('fails a sync whose lease ran out on its last attempt', async () => {
      const { sync } = await start('alice');
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        await claim();
        await expireLease(sync.id);
      }

      expect(await claim()).toBeUndefined();
      expect(await getCollectionSync(database(), { syncId: sync.id })).toMatchObject({
        status: 'failed',
        error: `Gave up after ${MAX_ATTEMPTS} attempts`,
        lockedBy: null,
      });
    });
  });

  describe('renewCollectionSyncLease', () => {
    it('extends a lease the worker holds', async () => {
      const { sync } = await start('alice');
      await claim();
      await expireLease(sync.id);

      const renewed = await renewCollectionSyncLease(database(), {
        syncId: sync.id,
        workerId: WORKER,
        holdSeconds: HOLD_SECONDS,
      });

      expect(renewed?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    });

    it('returns undefined once another worker took the sync', async () => {
      const { sync } = await start('alice');
      await claim();
      await expireLease(sync.id);
      await claim('worker-b');

      expect(
        await renewCollectionSyncLease(database(), {
          syncId: sync.id,
          workerId: WORKER,
          holdSeconds: HOLD_SECONDS,
        }),
      ).toBeUndefined();
    });
  });

  describe('getCollectionSync', () => {
    it('returns undefined for an unknown id', async () => {
      expect(
        await getCollectionSync(database(), { syncId: '00000000-0000-4000-8000-000000000000' }),
      ).toBeUndefined();
    });

    it('returns the sync', async () => {
      const { sync } = await start('alice');

      expect(await getCollectionSync(database(), { syncId: sync.id })).toEqual(sync);
    });
  });

  describe('getLatestCollectionSync', () => {
    it('returns undefined for an unknown user', async () => {
      expect(await getLatestCollectionSync(database(), { username: 'nobody' })).toBeUndefined();
    });

    it('returns undefined for a user that never synced', async () => {
      await ensureUser(database(), { username: 'alice' });

      expect(await getLatestCollectionSync(database(), { username: 'alice' })).toBeUndefined();
    });

    it('returns the most recently started sync, matching the username in any case', async () => {
      const first = await start('alice');
      await backdate({ syncId: first.sync.id, seconds: 3_600 });
      await claimAndFinish(first.sync.id);
      const second = await start('alice');

      expect((await getLatestCollectionSync(database(), { username: 'ALICE' }))?.id).toBe(
        second.sync.id,
      );
    });

    it("ignores another user's syncs", async () => {
      await start('alice');

      expect(await getLatestCollectionSync(database(), { username: 'bob' })).toBeUndefined();
    });
  });

  describe('finishCollectionSync', () => {
    it('records success with no error and releases the lease', async () => {
      const { sync } = await start('alice');

      const finished = await claimAndFinish(sync.id);

      expect(finished).toMatchObject({
        status: 'succeeded',
        error: null,
        lockedBy: null,
        lockedUntil: null,
      });
      expect(finished?.finishedAt).toBeInstanceOf(Date);
    });

    it('records failure with its error', async () => {
      const { sync } = await start('alice');
      await claim();

      const finished = await finishCollectionSync(database(), {
        syncId: sync.id,
        workerId: WORKER,
        outcome: { status: 'failed', error: 'BGG returned 500' },
      });

      expect(finished).toMatchObject({ status: 'failed', error: 'BGG returned 500' });
    });

    it('refuses a worker that does not hold the sync', async () => {
      const { sync } = await start('alice');
      await claim();

      const finished = await finishCollectionSync(database(), {
        syncId: sync.id,
        workerId: 'worker-b',
        outcome: { status: 'succeeded' },
      });

      expect(finished).toBeUndefined();
      expect((await getCollectionSync(database(), { syncId: sync.id }))?.status).toBe('running');
    });

    it('leaves an already finished sync untouched', async () => {
      const { sync } = await start('alice');
      await claimAndFinish(sync.id);

      const again = await finishCollectionSync(database(), {
        syncId: sync.id,
        workerId: WORKER,
        outcome: { status: 'failed', error: 'late' },
      });

      expect(again).toBeUndefined();
      expect((await getCollectionSync(database(), { syncId: sync.id }))?.status).toBe('succeeded');
    });
  });
});
