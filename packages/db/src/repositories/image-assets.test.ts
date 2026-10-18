import { describe, expect, it } from 'vitest';

import { SEED_GAMES } from '../dev/seed-data.ts';
import { resolveTestServerUrl, useTestDatabase } from '../dev/test-database.ts';
import { imageAssets } from '../schema/index.ts';
import { upsertGame } from './games.ts';
import { listImageAssets } from './image-assets.ts';

const serverUrl = await resolveTestServerUrl();

const [CATAN, CARCASSONNE] = SEED_GAMES;
if (CATAN === undefined || CARCASSONNE === undefined) {
  throw new Error('The seed data needs at least two games');
}

describe.skipIf(serverUrl === undefined)('image assets', () => {
  const database = useTestDatabase(serverUrl);

  function asset({ bggGameId, kind }: { bggGameId: number; kind: 'cover' | 'thumb' }) {
    return {
      bggGameId,
      kind,
      storageKey: `covers/${bggGameId}.${kind}.webp`,
      contentType: 'image/webp',
      width: 1024,
      height: 768,
      byteSize: 1_000,
      sideColor: '#112233',
      edgeColor: '#000000',
    };
  }

  describe('listImageAssets', () => {
    it('returns nothing for no ids', async () => {
      expect(await listImageAssets(database(), { bggGameIds: [] })).toEqual([]);
    });

    it("returns every kind for the requested games and no other game's", async () => {
      await upsertGame(database(), { game: CATAN });
      await upsertGame(database(), { game: CARCASSONNE });
      await database()
        .insert(imageAssets)
        .values([
          asset({ bggGameId: CATAN.id, kind: 'cover' }),
          asset({ bggGameId: CATAN.id, kind: 'thumb' }),
          asset({ bggGameId: CARCASSONNE.id, kind: 'cover' }),
        ]);

      const assets = await listImageAssets(database(), { bggGameIds: [CATAN.id] });

      expect(assets.map(({ bggGameId, kind }) => ({ bggGameId, kind }))).toEqual(
        expect.arrayContaining([
          { bggGameId: CATAN.id, kind: 'cover' },
          { bggGameId: CATAN.id, kind: 'thumb' },
        ]),
      );
      expect(assets).toHaveLength(2);
    });
  });
});
