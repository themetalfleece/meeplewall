import {
  bggGames,
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
import { FakeBggClient, FakeCollectionProvider, bggGame } from './testing/bgg-fakes.ts';
import { resolveTestServerUrl, useTestDatabase } from './testing/test-database.ts';

const serverUrl = await resolveTestServerUrl();

const AZUL = bggGame({ bggId: 230802, name: 'Azul' });
const CATAN = bggGame({ bggId: 13, name: 'CATAN' });
const BARE = bggGame({ bggId: 7, name: 'Bare Box', imageUrl: null });

function collected(bggId: number, overrides: Partial<CollectedGame> = {}): CollectedGame {
  return { bggId, owned: true, wantToPlay: false, userRating: null, ...overrides };
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

  async function startAndRun(service: CollectionSyncService, username: string) {
    const request = await service.requestSync({ username });
    if (request.kind !== 'started') {
      throw new Error(`Expected a started sync, got ${request.kind}`);
    }

    return {
      sync: request.sync,
      outcome: await service.runSync({ sync: request.sync, username, source: 'user' }),
    };
  }

  describe('requestSync', () => {
    it('starts a sync for a user seen for the first time', async () => {
      const request = await createService().requestSync({ username: 'alice' });

      expect(request.kind).toBe('started');
      expect(request.sync.status).toBe('running');
    });

    it('joins the sync already running', async () => {
      const service = createService();
      const first = await service.requestSync({ username: 'alice' });

      const second = await service.requestSync({ username: 'Alice' });

      expect(second).toEqual({ kind: 'joined', sync: first.sync });
    });

    it('declines a new sync within the throttle window after the last one finished', async () => {
      const service = createService({ collections: { alice: [] } });
      await startAndRun(service, 'alice');

      const request = await service.requestSync({ username: 'alice' });

      expect(request.kind).toBe('throttled');
      expect(request.kind === 'throttled' && request.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('starts again once the throttle window has passed', async () => {
      let now = new Date();
      const service = createService({ collections: { alice: [] }, now: () => now });
      await startAndRun(service, 'alice');
      now = new Date(now.getTime() + (SYNC_THROTTLE_SECONDS + 1) * 1_000);

      const request = await service.requestSync({ username: 'alice' });

      expect(request.kind).toBe('started');
    });
  });

  describe('runSync', () => {
    it('stores the collection sorted by name with the user flags, and succeeds', async () => {
      const service = createService({
        collections: {
          alice: [
            collected(CATAN.bggId, { wantToPlay: true }),
            collected(AZUL.bggId, { owned: false, userRating: 8.5 }),
          ],
        },
      });

      const { sync, outcome } = await startAndRun(service, 'alice');

      expect(outcome).toEqual({ status: 'succeeded' });
      expect((await getCollectionSync(database(), { syncId: sync.id }))?.status).toBe('succeeded');
      const stored = await getCollectionByUsername(database(), { username: 'alice' });
      expect(stored?.collection).toMatchObject({ source: 'geekdo', itemCount: 2 });
      expect(stored?.items.map(({ game, item }) => [game.name, item])).toEqual([
        ['Azul', expect.objectContaining({ owned: false, userRating: 8.5, sortIndex: 0 })],
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
      let now = new Date();
      const bgg = new FakeBggClient({ games: [AZUL, CATAN] });
      const service = createService({
        bgg,
        collections: { alice: [collected(AZUL.bggId)] },
        now: () => now,
      });
      await startAndRun(service, 'alice');
      now = new Date(now.getTime() + (SYNC_THROTTLE_SECONDS + 1) * 1_000);
      const failing = createService({
        bgg,
        collections: { alice: [collected(AZUL.bggId), collected(CATAN.bggId)] },
        now: () => now,
      });
      bgg.failWith(new Error('BGG answered 500'));

      const { outcome } = await startAndRun(failing, 'alice');

      expect(outcome).toEqual({ status: 'failed', error: 'BGG answered 500' });
      const stored = await getCollectionByUsername(database(), { username: 'alice' });
      expect(stored?.items.map(({ game }) => game.id)).toEqual([AZUL.bggId]);
    });
  });
});
