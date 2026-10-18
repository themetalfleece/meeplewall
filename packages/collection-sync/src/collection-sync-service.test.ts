import {
  bggGames,
  claimNextCollectionSync,
  collectionSyncs,
  getCollectionByUsername,
  getCollectionSync,
  imageAssets,
  imageJobs,
  refreshLog,
  upsertGame,
} from '@meeplewall/db';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { CollectedGame } from './collection-provider.ts';
import { CollectionSyncService } from './collection-sync-service.ts';
import { SYNC_THROTTLE_SECONDS } from './freshness.ts';
import { toGameInput } from './game-input.ts';
import { requestCollectionSync } from './request-sync.ts';
import { FakeBggClient, FakeCollectionProvider, bggGame } from './testing/bgg-fakes.ts';
import { resolveTestServerUrl, useTestDatabase } from './testing/test-database.ts';

const serverUrl = await resolveTestServerUrl();

const AZUL = bggGame({ bggId: 230802, name: 'Azul' });
const CATAN = bggGame({ bggId: 13, name: 'CATAN' });
const BARE = bggGame({ bggId: 7, name: 'Bare Box', imageUrl: null });

const WORKER = 'sync-worker-test';

function collected(bggId: number, overrides: Partial<CollectedGame> = {}): CollectedGame {
  return {
    bggId,
    owned: true,
    previouslyOwned: false,
    forTrade: false,
    wantInTrade: false,
    wantToPlay: false,
    wantToBuy: false,
    wishlist: false,
    wishlistPriority: null,
    preordered: false,
    userRating: null,
    ...overrides,
  };
}

describe.skipIf(serverUrl === undefined)('CollectionSyncService', () => {
  const database = useTestDatabase(serverUrl);

  function createService({
    bgg = new FakeBggClient({ games: [AZUL, CATAN, BARE] }),
    collections = {},
    now = () => new Date(),
  }: {
    bgg?: FakeBggClient;
    collections?: Record<string, CollectedGame[]>;
    now?: () => Date;
  } = {}) {
    const provider = new FakeCollectionProvider({ collections });

    return new CollectionSyncService({ database: database(), bgg, provider, now });
  }

  /** Queues a sync the way the web app does, then claims it the way the sync worker does. */
  async function startAndClaim(username: string) {
    const request = await requestCollectionSync(database(), { username, source: 'user' });
    if (request.kind !== 'started') {
      throw new Error(`Expected a started sync, got ${request.kind}`);
    }
    const claimed = await claimNextCollectionSync(database(), {
      workerId: WORKER,
      holdSeconds: 60,
      maxAttempts: 3,
    });
    if (claimed?.sync.id !== request.sync.id) {
      throw new Error('Expected to claim the sync just started');
    }

    return claimed;
  }

  async function startAndRun(service: CollectionSyncService, username: string) {
    const claimed = await startAndClaim(username);

    return {
      sync: claimed.sync,
      outcome: await service.runSync({ claimed, workerId: WORKER }),
    };
  }

  describe('runSync', () => {
    it('stores the collection sorted by name with the user flags, and succeeds', async () => {
      const service = createService({
        collections: {
          alice: [
            collected(CATAN.bggId, { wantToPlay: true }),
            collected(AZUL.bggId, {
              owned: false,
              wishlist: true,
              wishlistPriority: 2,
              userRating: 8.5,
            }),
          ],
        },
      });

      const { sync, outcome } = await startAndRun(service, 'alice');

      expect(outcome).toEqual({ status: 'succeeded' });
      expect((await getCollectionSync(database(), { syncId: sync.id }))?.status).toBe('succeeded');
      const stored = await getCollectionByUsername(database(), { username: 'alice' });
      expect(stored?.collection).toMatchObject({ source: 'geekdo', itemCount: 2 });
      expect(stored?.items.map(({ game, item }) => [game.name, item])).toEqual([
        [
          'Azul',
          expect.objectContaining({
            owned: false,
            wishlist: true,
            wishlistPriority: 2,
            userRating: 8.5,
            sortIndex: 0,
          }),
        ],
        ['CATAN', expect.objectContaining({ wantToPlay: true, sortIndex: 1 })],
      ]);
    });

    it('records the refresh with its source and duration', async () => {
      const service = createService({ collections: { alice: [collected(AZUL.bggId)] } });

      const { sync } = await startAndRun(service, 'alice');

      const [entry] = await database()
        .select()
        .from(refreshLog)
        .where(eq(refreshLog.userId, sync.userId));
      expect(entry).toMatchObject({ source: 'user', status: 'succeeded' });
      expect(entry?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('queues a cover and a thumb for each game with an image and none without', async () => {
      const service = createService({
        collections: { alice: [collected(AZUL.bggId), collected(BARE.bggId)] },
      });

      await startAndRun(service, 'alice');

      const jobs = await database().select().from(imageJobs);
      expect(jobs.map(({ bggGameId, kind }) => `${bggGameId}:${kind}`).sort()).toEqual([
        `${AZUL.bggId}:cover`,
        `${AZUL.bggId}:thumb`,
      ]);
    });

    it('queues no job for an image already processed', async () => {
      await upsertGame(database(), { game: toGameInput({ game: AZUL, versions: [] }) });
      await database().insert(imageAssets).values({
        bggGameId: AZUL.bggId,
        kind: 'cover',
        storageKey: 'covers/230802.webp',
        contentType: 'image/webp',
        width: 1024,
        height: 1024,
        byteSize: 1,
        sideColor: '#123456',
        edgeColor: '#000000',
      });
      const service = createService({ collections: { alice: [collected(AZUL.bggId)] } });

      await startAndRun(service, 'alice');

      const jobs = await database().select().from(imageJobs);
      expect(jobs.map(({ kind }) => kind)).toEqual(['thumb']);
    });

    it('reuses a fresh stored game and refetches a stale one', async () => {
      await upsertGame(database(), { game: toGameInput({ game: AZUL, versions: [] }) });
      await upsertGame(database(), { game: toGameInput({ game: CATAN, versions: [] }) });
      await database()
        .update(bggGames)
        .set({ updatedAt: sql`now() - interval '31 days'` })
        .where(eq(bggGames.id, CATAN.bggId));
      const bgg = new FakeBggClient({ games: [AZUL, CATAN] });
      const service = createService({
        bgg,
        collections: { alice: [collected(AZUL.bggId), collected(CATAN.bggId)] },
      });

      await startAndRun(service, 'alice');

      expect(bgg.fetchedGameIds).toEqual([CATAN.bggId]);
    });

    it('drops a game BGG does not know and counts each game once', async () => {
      const service = createService({
        collections: {
          alice: [collected(AZUL.bggId), collected(999_999), collected(AZUL.bggId)],
        },
      });

      await startAndRun(service, 'alice');

      const stored = await getCollectionByUsername(database(), { username: 'alice' });
      expect(stored?.items.map(({ game }) => game.id)).toEqual([AZUL.bggId]);
    });

    it('fails when BGG has no such user, and stores no collection', async () => {
      const { outcome } = await startAndRun(createService(), 'ghost');

      expect(outcome).toEqual({ status: 'failed', error: 'BGG has no user named "ghost"' });
      expect(await getCollectionByUsername(database(), { username: 'ghost' })).toBeUndefined();
    });

    it('fails on a BGG error and keeps the previously stored collection', async () => {
      const bgg = new FakeBggClient({ games: [AZUL, CATAN] });
      const service = createService({ bgg, collections: { alice: [collected(AZUL.bggId)] } });
      const { sync: first } = await startAndRun(service, 'alice');
      await database()
        .update(collectionSyncs)
        .set({ startedAt: sql`now() - make_interval(secs => ${SYNC_THROTTLE_SECONDS + 1})` })
        .where(eq(collectionSyncs.id, first.id));
      const failing = createService({
        bgg,
        collections: { alice: [collected(AZUL.bggId), collected(CATAN.bggId)] },
      });
      bgg.failWith(new Error('BGG answered 500'));

      const { outcome } = await startAndRun(failing, 'alice');

      expect(outcome).toEqual({ status: 'failed', error: 'BGG answered 500' });
      const stored = await getCollectionByUsername(database(), { username: 'alice' });
      expect(stored?.items.map(({ game }) => game.id)).toEqual([AZUL.bggId]);
    });

    it('reports a lost lease and leaves the result to the worker that took over', async () => {
      const service = createService({ collections: { alice: [collected(AZUL.bggId)] } });
      const claimed = await startAndClaim('alice');
      await database()
        .update(collectionSyncs)
        .set({ lockedBy: 'another-worker' })
        .where(eq(collectionSyncs.id, claimed.sync.id));

      const outcome = await service.runSync({ claimed, workerId: WORKER });

      expect(outcome).toEqual({ status: 'lost' });
      expect((await getCollectionSync(database(), { syncId: claimed.sync.id }))?.status).toBe(
        'running',
      );
      expect(
        await database()
          .select()
          .from(refreshLog)
          .where(eq(refreshLog.userId, claimed.sync.userId)),
      ).toEqual([]);
    });
  });
});
