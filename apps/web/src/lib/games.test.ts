import type { BggGame } from '@meeplewall/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  getGame: vi.fn(),
  listImageAssets: vi.fn(),
}));

vi.mock('next/cache', () => ({ cacheLife: mocks.cacheLife, cacheTag: mocks.cacheTag }));
vi.mock('@meeplewall/db', () => ({
  getGame: mocks.getGame,
  listImageAssets: mocks.listImageAssets,
}));
vi.mock('./services', () => ({ getDatabase: () => 'database' }));

const { loadGame } = await import('./games');

const CATAN: BggGame = {
  id: 13,
  name: 'CATAN',
  year: 1995,
  description: 'Trade and build.',
  minPlayers: 3,
  maxPlayers: 4,
  minPlayTime: 60,
  maxPlayTime: 120,
  weight: 2.3,
  averageRating: 7.1,
  ratingCount: 100_000,
  categories: ['Economic'],
  mechanics: ['Trading'],
  publisher: 'KOSMOS',
  imageUrlRaw: 'https://cf.geekdo-images.com/13.jpg',
  thumbUrlRaw: 'https://cf.geekdo-images.com/13.thumb.jpg',
  boxWidthMm: 296,
  boxDepthMm: 72,
  boxHeightMm: 296,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
};

beforeEach(() => {
  vi.stubEnv('STORAGE_PUBLIC_BASE_URL', 'https://cdn.example.com');
  mocks.listImageAssets.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe('loadGame', () => {
  it('returns the game view with its box and tags it for revalidation', async () => {
    mocks.getGame.mockResolvedValue(CATAN);

    const view = await loadGame({ bggId: 13 });

    expect(view).toMatchObject({
      bggId: 13,
      name: 'CATAN',
      players: { min: 3, max: 4 },
      playTime: { min: 60, max: 120 },
      images: { coverUrl: 'https://cf.geekdo-images.com/13.jpg', processedCoverUrl: null },
      box: { size: { width: 296, height: 296, depth: 72 } },
    });
    expect(mocks.cacheTag).toHaveBeenCalledWith('game:13');
    expect(mocks.cacheLife).toHaveBeenCalledWith('days');
    expect(mocks.listImageAssets).toHaveBeenCalledWith('database', { bggGameIds: [13] });
  });

  it('returns null for an unknown game and caches the miss briefly', async () => {
    mocks.getGame.mockResolvedValue(undefined);

    expect(await loadGame({ bggId: 404 })).toBeNull();
    expect(mocks.cacheLife).toHaveBeenCalledTimes(1);
    expect(mocks.cacheLife).toHaveBeenCalledWith('minutes');
    expect(mocks.listImageAssets).not.toHaveBeenCalled();
  });
});
