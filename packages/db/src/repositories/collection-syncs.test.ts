import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { resolveTestServerUrl, useTestDatabase } from '../dev/test-database.ts';
import { collectionSyncs } from '../schema/index.ts';
import {
  finishCollectionSync,
  getCollectionSync,
  startCollectionSync,
} from './collection-syncs.ts';
import { findUser } from './users.ts';

const serverUrl = await resolveTestServerUrl();

const STALE_AFTER_SECONDS = 600;

describe.skipIf(serverUrl === undefined)('collection syncs', () => {
  const database = useTestDatabase(serverUrl);

  function start(username: string) {
    return startCollectionSync(database(), { username, staleAfterSeconds: STALE_AFTER_SECONDS });
  }

  describe('startCollectionSync', () => {
    it('creates the user and a running sync on first visit', async () => {
      const { sync, started } = await start('alice');

      expect(started).toBe(true);
      expect(sync).toMatchObject({ status: 'running', error: null, finishedAt: null });
      expect((await findUser(database(), { username: 'alice' }))?.id).toBe(sync.userId);
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
      await finishCollectionSync(database(), {
        syncId: first.sync.id,
        outcome: { status: 'succeeded' },
      });

      const second = await start('alice');

      expect(second.started).toBe(true);
      expect(second.sync.id).not.toBe(first.sync.id);
    });

    it('fails an abandoned sync and starts a fresh one', async () => {
      const abandoned = await start('alice');
      await database()
        .update(collectionSyncs)
        .set({ startedAt: sql`now() - make_interval(secs => ${STALE_AFTER_SECONDS + 1})` })
        .where(eq(collectionSyncs.id, abandoned.sync.id));

      const fresh = await start('alice');

      expect(fresh.started).toBe(true);
      expect(await getCollectionSync(database(), { syncId: abandoned.sync.id })).toMatchObject({
        status: 'failed',
        error: 'Abandoned while running',
      });
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

  describe('finishCollectionSync', () => {
    it('records success with no error', async () => {
      const { sync } = await start('alice');

      const finished = await finishCollectionSync(database(), {
        syncId: sync.id,
        outcome: { status: 'succeeded' },
      });

      expect(finished).toMatchObject({ status: 'succeeded', error: null });
      expect(finished?.finishedAt).toBeInstanceOf(Date);
    });

    it('records failure with its error', async () => {
      const { sync } = await start('alice');

      const finished = await finishCollectionSync(database(), {
        syncId: sync.id,
        outcome: { status: 'failed', error: 'BGG returned 500' },
      });

      expect(finished).toMatchObject({ status: 'failed', error: 'BGG returned 500' });
    });

    it('leaves an already finished sync untouched', async () => {
      const { sync } = await start('alice');
      await finishCollectionSync(database(), { syncId: sync.id, outcome: { status: 'succeeded' } });

      const again = await finishCollectionSync(database(), {
        syncId: sync.id,
        outcome: { status: 'failed', error: 'late' },
      });

      expect(again).toBeUndefined();
      expect((await getCollectionSync(database(), { syncId: sync.id }))?.status).toBe('succeeded');
    });
  });
});
