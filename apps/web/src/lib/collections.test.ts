import { SYNC_ABANDONED_AFTER_SECONDS } from '@meeplewall/collection-sync';
import type { BggGame, CollectionSync, CollectionWithItems, ImageAsset } from '@meeplewall/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCollectionByUsername: vi.fn(),
  getCollectionEntry: vi.fn(),
  getLatestCollectionSync: vi.fn(),
  listImageAssets: vi.fn(),
  requestCollectionSync: vi.fn(),
}));

vi.mock('@meeplewall/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@meeplewall/db')>()),
  getCollectionByUsername: mocks.getCollectionByUsername,
  getCollectionEntry: mocks.getCollectionEntry,
  getLatestCollectionSync: mocks.getLatestCollectionSync,
  listImageAssets: mocks.listImageAssets,
}));
vi.mock('@meeplewall/collection-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@meeplewall/collection-sync')>()),
  requestCollectionSync: mocks.requestCollectionSync,
}));
vi.mock('./services', () => ({ getDatabase: () => 'database' }));

const { loadCollectionGame, loadCollectionPage, loadCollectionSummary } =
  await import('./collections');

const NOW = Date.now();
const FRESH = new Date(NOW - 60_000);
const STALE = new Date(NOW - 2 * 24 * 3_600_000);

const NO_STATUS = {
  owned: false,
  previouslyOwned: false,
  forTrade: false,
  wantInTrade: false,
  wantToPlay: false,
  wantToBuy: false,
  wishlist: false,
  wishlistPriority: null,
  preordered: false,
};

function game(id: number, name: string): BggGame {
  return {
    id,
    name,
    year: 2020,
    description: null,
    minPlayers: 1,
    maxPlayers: 4,
    minPlayTime: 30,
    maxPlayTime: 60,
    weight: null,
    averageRating: null,
    ratingCount: null,
    categories: [],
    mechanics: [],
    publisher: null,
    imageUrlRaw: `https://cf.geekdo-images.com/${id}.jpg`,
    thumbUrlRaw: `https://cf.geekdo-images.com/${id}.thumb.jpg`,
    boxWidthMm: null,
    boxDepthMm: null,
    boxHeightMm: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
  };
}

function stored(fetchedAt: Date): CollectionWithItems {
  const user = {
    id: 'user-1',
    bggUsername: 'Alice',
    firstSeenAt: new Date(NOW),
    lastSyncedAt: fetchedAt,
  };
  const collectionId = 'collection-1';

  return {
    user,
    collection: { id: collectionId, userId: user.id, fetchedAt, source: 'xmlapi2', itemCount: 2 },
    items: [
      {
        item: {
          ...NO_STATUS,
          collectionId,
          bggGameId: 1,
          owned: true,
          userRating: 8,
          sortIndex: 0,
        },
        game: game(1, 'Azul'),
      },
      {
        item: {
          ...NO_STATUS,
          collectionId,
          bggGameId: 2,
          wantToPlay: true,
          wishlist: true,
          wishlistPriority: 1,
          userRating: null,
          sortIndex: 1,
        },
        game: game(2, 'CATAN'),
      },
    ],
  };
}

function sync(
  status: CollectionSync['status'],
  startedAt: Date = new Date(NOW - 1_000),
): CollectionSync {
  return {
    id: 'sync-1',
    userId: 'user-1',
    status,
    source: 'api',
    error: null,
    attempts: 0,
    lockedBy: null,
    lockedUntil: null,
    startedAt,
    finishedAt: status === 'running' ? null : new Date(NOW),
  };
}

const THUMB: ImageAsset = {
  id: 7,
  bggGameId: 1,
  kind: 'thumb',
  storageKey: 'covers/1.abc.thumb.webp',
  contentType: 'image/webp',
  width: 320,
  height: 320,
  byteSize: 10,
  sideColor: '#111111',
  edgeColor: '#000000',
  createdAt: new Date(NOW),
};

beforeEach(() => {
  vi.stubEnv('STORAGE_PUBLIC_BASE_URL', 'https://cdn.example.com');
  mocks.listImageAssets.mockResolvedValue([]);
  mocks.getLatestCollectionSync.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe('loadCollectionPage', () => {
  it('queues a sync for an unknown user and returns no cards yet', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(undefined);
    mocks.requestCollectionSync.mockResolvedValue({ kind: 'started', sync: sync('running') });

    const page = await loadCollectionPage({ username: 'alice', shelf: 'owned' });

    expect(page).toMatchObject({ displayName: 'alice', cards: null, fetchedAt: null });
    expect(page.sync.state).toBe('running');
    expect(mocks.requestCollectionSync).toHaveBeenCalledWith('database', {
      username: 'alice',
      source: 'api',
    });
  });

  it('renders a fresh collection without starting a sync', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(stored(FRESH));
    mocks.getLatestCollectionSync.mockResolvedValue(sync('succeeded'));
    mocks.listImageAssets.mockResolvedValue([THUMB]);

    const page = await loadCollectionPage({ username: 'alice', shelf: 'owned' });

    expect(mocks.requestCollectionSync).not.toHaveBeenCalled();
    expect(page.displayName).toBe('Alice');
    expect(page.sync.state).toBe('succeeded');
    expect(page.cards).toEqual([
      {
        bggId: 1,
        name: 'Azul',
        year: 2020,
        thumbUrl: 'https://cdn.example.com/covers/1.abc.thumb.webp',
        badges: [
          { kind: 'owned', label: 'Owned' },
          { kind: 'rating', label: 'Rated 8' },
        ],
      },
    ]);
  });

  it('keeps wishlist games off the main wall and lists every shelf with a game', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(stored(FRESH));

    const page = await loadCollectionPage({ username: 'alice', shelf: 'owned' });

    expect(page.cards?.map((card) => card.name)).toEqual(['Azul']);
    expect(page.shelves).toEqual([
      { shelf: 'owned', label: 'Owned', count: 1 },
      { shelf: 'wishlist', label: 'Wishlist', count: 1 },
      { shelf: 'wantToPlay', label: 'Want to play', count: 1 },
    ]);
  });

  it('shows the requested shelf', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(stored(FRESH));

    const page = await loadCollectionPage({ username: 'alice', shelf: 'wishlist' });

    expect(page.shelf).toBe('wishlist');
    expect(page.cards).toEqual([
      expect.objectContaining({
        name: 'CATAN',
        badges: [
          { kind: 'wishlist', label: 'Wishlist: Must have' },
          { kind: 'wantToPlay', label: 'Want to play' },
        ],
      }),
    ]);
    expect(mocks.listImageAssets).toHaveBeenCalledWith('database', { bggGameIds: [2] });
  });

  it('keeps an empty requested shelf in the list', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(stored(FRESH));

    const page = await loadCollectionPage({ username: 'alice', shelf: 'forTrade' });

    expect(page.cards).toEqual([]);
    expect(page.shelves.map((tab) => tab.shelf)).toContain('forTrade');
  });

  it('keeps showing a stale collection while it starts a refresh', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(stored(STALE));
    mocks.requestCollectionSync.mockResolvedValue({ kind: 'started', sync: sync('running') });

    const page = await loadCollectionPage({ username: 'alice', shelf: 'owned' });

    expect(page.cards).toHaveLength(1);
    expect(page.sync.state).toBe('running');
  });

  it('does not ask again while a sync is already running', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(undefined);
    mocks.getLatestCollectionSync.mockResolvedValue(sync('running'));

    const page = await loadCollectionPage({ username: 'alice', shelf: 'owned' });

    expect(mocks.requestCollectionSync).not.toHaveBeenCalled();
    expect(page.sync.state).toBe('running');
  });

  it('queues a fresh sync when the last one was never picked up', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(undefined);
    const abandonedAt = new Date(NOW - (SYNC_ABANDONED_AFTER_SECONDS + 60) * 1_000);
    mocks.getLatestCollectionSync.mockResolvedValue(sync('running', abandonedAt));
    mocks.requestCollectionSync.mockResolvedValue({ kind: 'started', sync: sync('running') });

    const page = await loadCollectionPage({ username: 'alice', shelf: 'owned' });

    expect(mocks.requestCollectionSync).toHaveBeenCalledWith('database', {
      username: 'alice',
      source: 'api',
    });
    expect(page.sync.state).toBe('running');
  });

  it('reports the last failed sync when a retry is throttled', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(undefined);
    mocks.getLatestCollectionSync.mockResolvedValue(sync('failed'));
    mocks.requestCollectionSync.mockResolvedValue({
      kind: 'throttled',
      sync: sync('failed'),
      retryAfterSeconds: 20,
    });

    const page = await loadCollectionPage({ username: 'alice', shelf: 'owned' });

    expect(page.sync.state).toBe('failed');
  });
});

describe('loadCollectionGame', () => {
  it('returns null for a game outside the collection', async () => {
    mocks.getCollectionEntry.mockResolvedValue(undefined);

    expect(await loadCollectionGame({ username: 'alice', bggId: 9, shelf: 'owned' })).toBeNull();
  });

  it('returns the overlay with a one-based position and the neighbours', async () => {
    const { user, items } = stored(FRESH);
    const [first] = items;
    mocks.getCollectionEntry.mockResolvedValue({
      user,
      item: first?.item,
      game: first?.game,
      shelf: 'owned',
      position: 0,
      itemCount: 2,
      previous: null,
      next: { bggGameId: 2, name: 'CATAN' },
    });

    expect(await loadCollectionGame({ username: 'alice', bggId: 1, shelf: 'owned' })).toEqual({
      displayName: 'Alice',
      shelf: 'owned',
      badges: [
        { kind: 'owned', label: 'Owned' },
        { kind: 'rating', label: 'Rated 8' },
      ],
      position: 1,
      itemCount: 2,
      previous: null,
      next: { bggGameId: 2, name: 'CATAN' },
    });
    expect(mocks.getCollectionEntry).toHaveBeenCalledWith('database', {
      username: 'alice',
      bggGameId: 1,
      shelf: 'owned',
    });
  });
});

describe('loadCollectionSummary', () => {
  it('returns null for a collection never stored', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(undefined);

    expect(await loadCollectionSummary({ username: 'alice' })).toBeNull();
  });

  it("summarises the main wall with BGG's thumbnails and starts no sync", async () => {
    mocks.getCollectionByUsername.mockResolvedValue(stored(STALE));

    expect(await loadCollectionSummary({ username: 'alice' })).toEqual({
      displayName: 'Alice',
      itemCount: 1,
      coverUrls: ['https://cf.geekdo-images.com/1.thumb.jpg'],
    });
    expect(mocks.requestCollectionSync).not.toHaveBeenCalled();
  });
});
