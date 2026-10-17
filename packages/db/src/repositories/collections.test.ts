import { describe, expect, it } from 'vitest';

import { SEED_COLLECTION, SEED_GAMES, SEED_USERNAME } from '../dev/seed-data.ts';
import { resolveTestServerUrl, useTestDatabase } from '../dev/test-database.ts';
import { getCollectionByUsername, upsertCollection } from './collections.ts';
import { upsertGame } from './games.ts';
import { findUser } from './users.ts';

const serverUrl = await resolveTestServerUrl();

const FETCHED_AT = new Date('2026-01-02T03:04:05.000Z');

describe.skipIf(serverUrl === undefined)('collections', () => {
  const database = useTestDatabase(serverUrl);

  async function seedGames() {
    for (const game of SEED_GAMES) {
      await upsertGame(database(), { game });
    }
  }

  describe('getCollectionByUsername', () => {
    it('returns undefined for an unknown user', async () => {
      expect(await getCollectionByUsername(database(), { username: 'nobody' })).toBeUndefined();
    });

    it('returns undefined for a known user that was never synced', async () => {
      await seedGames();
      await upsertCollection(database(), {
        username: 'other',
        source: 'geekdo',
        fetchedAt: FETCHED_AT,
        items: [],
      });

      expect(
        await getCollectionByUsername(database(), { username: SEED_USERNAME }),
      ).toBeUndefined();
    });

    it('returns the items in sort order with their games, matching the username in any case', async () => {
      await seedGames();
      await upsertCollection(database(), {
        username: SEED_USERNAME,
        source: 'geekdo',
        fetchedAt: FETCHED_AT,
        items: [...SEED_COLLECTION].reverse(),
      });

      const result = await getCollectionByUsername(database(), {
        username: SEED_USERNAME.toUpperCase(),
      });

      expect(result?.collection).toMatchObject({
        source: 'geekdo',
        fetchedAt: FETCHED_AT,
        itemCount: SEED_COLLECTION.length,
      });
      expect(result?.items.map(({ game }) => game.id)).toEqual(SEED_GAMES.map((game) => game.id));
      expect(result?.items[0]?.item.wantToPlay).toBe(true);
    });
  });

  describe('upsertCollection', () => {
    it('replaces the previous items instead of merging them', async () => {
      await seedGames();
      const upsert = (items: typeof SEED_COLLECTION) =>
        upsertCollection(database(), {
          username: SEED_USERNAME,
          source: 'geekdo',
          fetchedAt: FETCHED_AT,
          items,
        });
      const first = await upsert(SEED_COLLECTION);

      const second = await upsert(SEED_COLLECTION.slice(0, 1));

      expect(second.id).toBe(first.id);
      const result = await getCollectionByUsername(database(), { username: SEED_USERNAME });
      expect(result?.items).toHaveLength(1);
      expect(result?.collection.itemCount).toBe(1);
    });

    it('stores an empty collection', async () => {
      const collection = await upsertCollection(database(), {
        username: SEED_USERNAME,
        source: 'geekdo',
        fetchedAt: FETCHED_AT,
        items: [],
      });

      expect(collection.itemCount).toBe(0);
    });

    it('keeps the first entry when a game is listed twice', async () => {
      await seedGames();
      const [firstItem] = SEED_COLLECTION;
      if (firstItem === undefined) {
        throw new Error('The seed collection is empty');
      }

      await upsertCollection(database(), {
        username: SEED_USERNAME,
        source: 'geekdo',
        fetchedAt: FETCHED_AT,
        items: [firstItem, { ...firstItem, sortIndex: 99 }],
      });

      const result = await getCollectionByUsername(database(), { username: SEED_USERNAME });
      expect(result?.items.map(({ item }) => item.sortIndex)).toEqual([firstItem.sortIndex]);
      expect(result?.collection.itemCount).toBe(1);
    });

    it('records the sync time on the user', async () => {
      await upsertCollection(database(), {
        username: SEED_USERNAME,
        source: 'geekdo',
        fetchedAt: FETCHED_AT,
        items: [],
      });

      const user = await findUser(database(), { username: SEED_USERNAME });
      expect(user?.lastSyncedAt).toEqual(FETCHED_AT);
    });

    it('rejects an item whose game is not stored, leaving nothing behind', async () => {
      await expect(
        upsertCollection(database(), {
          username: SEED_USERNAME,
          source: 'geekdo',
          fetchedAt: FETCHED_AT,
          items: [{ bggGameId: 424_242, sortIndex: 0 }],
        }),
      ).rejects.toThrow();

      expect(await findUser(database(), { username: SEED_USERNAME })).toBeUndefined();
    });
  });
});
