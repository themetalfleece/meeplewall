import { SYNC_ABANDONED_AFTER_SECONDS } from '@meeplewall/collection-sync';
import type { BggGame, CollectionSync, CollectionWithItems, ImageAsset } from '@meeplewall/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCollectionByUsername: vi.fn(),
  getCollectionEntry: vi.fn(),
  getLatestCollectionSync: vi.fn(),
  listImageAssets: vi.fn(),
  requestSync: vi.fn(),
  runStartedSyncAfterResponse: vi.fn(),
}));

vi.mock('@meeplewall/db', () => ({
  getCollectionByUsername: mocks.getCollectionByUsername,
  getCollectionEntry: mocks.getCollectionEntry,
  getLatestCollectionSync: mocks.getLatestCollectionSync,
  listImageAssets: mocks.listImageAssets,
}));
vi.mock('./services', () => ({
  getDatabase: () => 'database',
  getSyncService: () => ({ requestSync: mocks.requestSync }),
}));
vi.mock('./sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./sync')>()),
  runStartedSyncAfterResponse: mocks.runStartedSyncAfterResponse,
}));

const { loadCollectionGame, loadCollectionPage, loadCollectionSummary } =
  await import('./collections');

const NOW = Date.now();
const FRESH = new Date(NOW - 60_000);
const STALE = new Date(NOW - 2 * 24 * 3_600_000);

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
          collectionId,
          bggGameId: 1,
          owned: true,
          wantToPlay: false,
          userRating: 8,
          sortIndex: 0,
        },
        game: game(1, 'Azul'),
      },
      {
        item: {
          collectionId,
          bggGameId: 2,
          owned: false,
          wantToPlay: true,
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
    error: null,
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
  it('starts a sync for an unknown user and returns no cards yet', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(undefined);
    const request = { kind: 'started', sync: sync('running') };
    mocks.requestSync.mockResolvedValue(request);

    const page = await loadCollectionPage({ username: 'alice' });

    expect(page).toMatchObject({ displayName: 'alice', cards: null, fetchedAt: null });
    expect(page.sync.state).toBe('running');
    expect(mocks.runStartedSyncAfterResponse).toHaveBeenCalledWith({
      request,
      username: 'alice',
      source: 'api',
    });
  });

  it('renders a fresh collection without starting a sync', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(stored(FRESH));
    mocks.getLatestCollectionSync.mockResolvedValue(sync('succeeded'));
    mocks.listImageAssets.mockResolvedValue([THUMB]);

    const page = await loadCollectionPage({ username: 'alice' });

    expect(mocks.requestSync).not.toHaveBeenCalled();
    expect(page.displayName).toBe('Alice');
    expect(page.sync.state).toBe('succeeded');
    expect(page.cards).toEqual([
      {
        bggId: 1,
        name: 'Azul',
        year: 2020,
        thumbUrl: 'https://cdn.example.com/covers/1.abc.thumb.webp',
        owned: true,
        wantToPlay: false,
        userRating: 8,
      },
      {
        bggId: 2,
        name: 'CATAN',
        year: 2020,
        thumbUrl: 'https://cf.geekdo-images.com/2.thumb.jpg',
        owned: false,
        wantToPlay: true,
        userRating: null,
      },
    ]);
  });

  it('keeps showing a stale collection while it starts a refresh', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(stored(STALE));
    mocks.requestSync.mockResolvedValue({ kind: 'started', sync: sync('running') });

    const page = await loadCollectionPage({ username: 'alice' });

    expect(page.cards).toHaveLength(2);
    expect(page.sync.state).toBe('running');
  });

  it('does not ask again while a sync is already running', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(undefined);
    mocks.getLatestCollectionSync.mockResolvedValue(sync('running'));

    const page = await loadCollectionPage({ username: 'alice' });

    expect(mocks.requestSync).not.toHaveBeenCalled();
    expect(page.sync.state).toBe('running');
  });

  it('restarts a sync left running by a crashed process', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(undefined);
    const abandonedAt = new Date(NOW - (SYNC_ABANDONED_AFTER_SECONDS + 60) * 1_000);
    mocks.getLatestCollectionSync.mockResolvedValue(sync('running', abandonedAt));
    const request = { kind: 'started', sync: sync('running') };
    mocks.requestSync.mockResolvedValue(request);

    const page = await loadCollectionPage({ username: 'alice' });

    expect(mocks.requestSync).toHaveBeenCalledWith({ username: 'alice' });
    expect(mocks.runStartedSyncAfterResponse).toHaveBeenCalledWith({
      request,
      username: 'alice',
      source: 'api',
    });
    expect(page.sync.state).toBe('running');
  });

  it('reports the last failed sync when a retry is throttled', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(undefined);
    mocks.getLatestCollectionSync.mockResolvedValue(sync('failed'));
    mocks.requestSync.mockResolvedValue({
      kind: 'throttled',
      sync: sync('failed'),
      retryAfterSeconds: 20,
    });

    const page = await loadCollectionPage({ username: 'alice' });

    expect(page.sync.state).toBe('failed');
  });
});

describe('loadCollectionGame', () => {
  it('returns null for a game outside the collection', async () => {
    mocks.getCollectionEntry.mockResolvedValue(undefined);

    expect(await loadCollectionGame({ username: 'alice', bggId: 9 })).toBeNull();
  });

  it('returns the overlay with a one-based position and the neighbours', async () => {
    const { user, items } = stored(FRESH);
    const [first] = items;
    mocks.getCollectionEntry.mockResolvedValue({
      user,
      item: first?.item,
      game: first?.game,
      position: 0,
      itemCount: 2,
      previous: null,
      next: { bggGameId: 2, name: 'CATAN' },
    });

    expect(await loadCollectionGame({ username: 'alice', bggId: 1 })).toEqual({
      displayName: 'Alice',
      owned: true,
      wantToPlay: false,
      userRating: 8,
      position: 1,
      itemCount: 2,
      previous: null,
      next: { bggGameId: 2, name: 'CATAN' },
    });
    expect(mocks.getCollectionEntry).toHaveBeenCalledWith('database', {
      username: 'alice',
      bggGameId: 1,
    });
  });
});

describe('loadCollectionSummary', () => {
  it('returns null for a collection never stored', async () => {
    mocks.getCollectionByUsername.mockResolvedValue(undefined);

    expect(await loadCollectionSummary({ username: 'alice' })).toBeNull();
  });

  it("summarises the stored collection with BGG's thumbnails and starts no sync", async () => {
    mocks.getCollectionByUsername.mockResolvedValue(stored(STALE));

    expect(await loadCollectionSummary({ username: 'alice' })).toEqual({
      displayName: 'Alice',
      itemCount: 2,
      coverUrls: [
        'https://cf.geekdo-images.com/1.thumb.jpg',
        'https://cf.geekdo-images.com/2.thumb.jpg',
      ],
    });
    expect(mocks.requestSync).not.toHaveBeenCalled();
  });
});
