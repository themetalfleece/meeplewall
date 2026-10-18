import { describe, expect, it } from 'vitest';

import { SEED_COLLECTION, SEED_GAMES, SEED_USERNAME } from '../dev/seed-data.ts';
import { resolveTestServerUrl, useTestDatabase } from '../dev/test-database.ts';
import { getCollectionByUsername, getCollectionEntry, upsertCollection } from './collections.ts';
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

  describe('getCollectionEntry', () => {
    async function seedCollection() {
      await seedGames();
      await upsertCollection(database(), {
        username: SEED_USERNAME,
        source: 'geekdo',
        fetchedAt: FETCHED_AT,
        items: SEED_COLLECTION,
      });
    }

    function gameAt(index: number) {
      const game = SEED_GAMES[index];
      if (game === undefined) {
        throw new Error(`The seed data has no game at ${index}`);
      }
      return game;
    }

    it('returns undefined for an unknown user', async () => {
      expect(
        await getCollectionEntry(database(), {
          username: 'nobody',
          bggGameId: gameAt(0).id,
          shelf: 'owned',
        }),
      ).toBeUndefined();
    });

    it('returns undefined for a game outside the collection', async () => {
      await seedCollection();

      expect(
        await getCollectionEntry(database(), {
          username: SEED_USERNAME,
          bggGameId: 999_999,
          shelf: 'owned',
        }),
      ).toBeUndefined();
    });

    it('returns a middle game with both neighbours in sort order', async () => {
      await seedCollection();

      const entry = await getCollectionEntry(database(), {
        username: SEED_USERNAME.toUpperCase(),
        bggGameId: gameAt(1).id,
        shelf: 'owned',
      });

      expect(entry).toMatchObject({
        position: 1,
        itemCount: SEED_GAMES.length,
        previous: { bggGameId: gameAt(0).id, name: gameAt(0).name },
        next: { bggGameId: gameAt(2).id, name: gameAt(2).name },
      });
      expect(entry?.game.name).toBe(gameAt(1).name);
      expect(entry?.user.bggUsername).toBe(SEED_USERNAME);
    });

    it('has no previous game at the start and no next game at the end', async () => {
      await seedCollection();
      const lastIndex = SEED_GAMES.length - 1;

      const first = await getCollectionEntry(database(), {
        username: SEED_USERNAME,
        bggGameId: gameAt(0).id,
        shelf: 'owned',
      });
      const last = await getCollectionEntry(database(), {
        username: SEED_USERNAME,
        bggGameId: gameAt(lastIndex).id,
        shelf: 'owned',
      });

      expect(first?.previous).toBeNull();
      expect(first?.item.wantToPlay).toBe(true);
      expect(last?.next).toBeNull();
      expect(last?.position).toBe(lastIndex);
    });

    /** The seed games with the first and third wishlisted rather than owned. */
    async function seedWishlist() {
      await seedGames();
      await upsertCollection(database(), {
        username: SEED_USERNAME,
        source: 'geekdo',
        fetchedAt: FETCHED_AT,
        items: SEED_COLLECTION.map((item, index) => ({
          ...item,
          owned: index % 2 === 1,
          wishlist: index % 2 === 0,
        })),
      });
    }

    it('counts the position and neighbours on the requested shelf only', async () => {
      await seedWishlist();

      const entry = await getCollectionEntry(database(), {
        username: SEED_USERNAME,
        bggGameId: gameAt(2).id,
        shelf: 'wishlist',
      });

      expect(entry).toMatchObject({
        shelf: 'wishlist',
        position: 1,
        itemCount: 2,
        previous: { bggGameId: gameAt(0).id },
        next: null,
      });
    });

    it('counts a game not on the requested shelf on the first shelf it sits on', async () => {
      await seedWishlist();

      const entry = await getCollectionEntry(database(), {
        username: SEED_USERNAME,
        bggGameId: gameAt(0).id,
        shelf: 'owned',
      });

      expect(entry).toMatchObject({ shelf: 'wishlist', position: 0, itemCount: 2 });
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
