import { describe, expect, it } from 'vitest';

import { SEED_GAMES } from '../dev/seed-data.ts';
import { resolveTestServerUrl, useTestDatabase } from '../dev/test-database.ts';
import { getGame, getGameName, listGames, upsertGame } from './games.ts';

const serverUrl = await resolveTestServerUrl();

const [CATAN, CARCASSONNE] = SEED_GAMES;
if (CATAN === undefined || CARCASSONNE === undefined) {
  throw new Error('The seed data needs at least two games');
}

describe.skipIf(serverUrl === undefined)('games', () => {
  const database = useTestDatabase(serverUrl);

  describe('getGame', () => {
    it('returns undefined for an unknown BGG id', async () => {
      expect(await getGame(database(), { bggId: 999_999 })).toBeUndefined();
    });

    it('returns the stored game with its jsonb lists', async () => {
      await upsertGame(database(), { game: CATAN });

      const game = await getGame(database(), { bggId: CATAN.id });

      expect(game).toMatchObject({ id: CATAN.id, name: CATAN.name, mechanics: CATAN.mechanics });
    });
  });

  describe('getGameName', () => {
    it('returns undefined for an unknown BGG id', async () => {
      expect(await getGameName(database(), { bggId: 999_999 })).toBeUndefined();
    });

    it("returns the stored game's name", async () => {
      await upsertGame(database(), { game: CATAN });

      expect(await getGameName(database(), { bggId: CATAN.id })).toBe(CATAN.name);
    });
  });

  describe('listGames', () => {
    it('returns nothing for no ids without querying', async () => {
      expect(await listGames(database(), { bggIds: [] })).toEqual([]);
    });

    it('returns the stored games and skips unknown ids', async () => {
      await upsertGame(database(), { game: CATAN });
      await upsertGame(database(), { game: CARCASSONNE });

      const games = await listGames(database(), { bggIds: [CARCASSONNE.id, 999_999] });

      expect(games.map((game) => game.id)).toEqual([CARCASSONNE.id]);
    });
  });

  describe('upsertGame', () => {
    it('defaults the category and mechanic lists to empty', async () => {
      const saved = await upsertGame(database(), { game: { id: 1, name: 'Bare' } });

      expect(saved).toMatchObject({ categories: [], mechanics: [], year: null });
    });

    it('updates an existing game in place and bumps updatedAt', async () => {
      const first = await upsertGame(database(), { game: CARCASSONNE });

      const second = await upsertGame(database(), {
        game: { id: CARCASSONNE.id, name: 'Carcassonne (renamed)' },
      });

      expect(second.name).toBe('Carcassonne (renamed)');
      expect(second.createdAt).toEqual(first.createdAt);
      expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
    });

    it('keeps fields the update leaves undefined', async () => {
      await upsertGame(database(), { game: CARCASSONNE });

      const updated = await upsertGame(database(), { game: { id: CARCASSONNE.id, name: 'X' } });

      expect(updated.year).toBe(CARCASSONNE.year);
      expect(updated.boxWidthMm).toBe(CARCASSONNE.boxWidthMm);
    });
  });
});
