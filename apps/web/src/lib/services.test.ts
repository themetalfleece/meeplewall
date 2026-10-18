import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { on } = vi.hoisted(() => ({ on: vi.fn() }));

vi.mock('@board-games/db', () => ({
  createDatabase: vi.fn(() => ({ $client: { on } })),
}));
vi.mock('@board-games/boardgamegeek', () => ({
  createBggClient: vi.fn(() => ({})),
  createBggCollectionClient: vi.fn(() => ({ transport: 'xmlapi2' })),
}));
vi.mock('@board-games/collection-sync', () => ({
  CollectionSyncService: vi.fn(),
}));

const { createDatabase } = await import('@board-games/db');
const { createBggCollectionClient } = await import('@board-games/boardgamegeek');
const { CollectionSyncService } = await import('@board-games/collection-sync');
const { getDatabase, getSyncService } = await import('./services');

beforeEach(() => {
  globalThis.boardGamesServices = undefined;
  vi.stubEnv('DATABASE_URL', 'postgres://localhost/test');
  vi.stubEnv('BGG_USER_AGENT', 'tests');
  vi.stubEnv('BGG_API_TOKEN', 'token');
});

afterEach(() => {
  globalThis.boardGamesServices = undefined;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('getDatabase', () => {
  it('opens the pool once and reuses it', () => {
    const first = getDatabase();

    expect(getDatabase()).toBe(first);
    expect(createDatabase).toHaveBeenCalledTimes(1);
    expect(createDatabase).toHaveBeenCalledWith({ connectionString: 'postgres://localhost/test' });
  });

  it('logs idle pool errors instead of crashing', () => {
    getDatabase();

    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('does not need the BGG variables', () => {
    vi.stubEnv('BGG_API_TOKEN', '');

    expect(() => getDatabase()).not.toThrow();
  });
});

describe('getSyncService', () => {
  it('creates the service once over the shared pool', () => {
    const first = getSyncService();

    expect(getSyncService()).toBe(first);
    expect(CollectionSyncService).toHaveBeenCalledTimes(1);
    expect(CollectionSyncService).toHaveBeenCalledWith(
      expect.objectContaining({ database: getDatabase() }),
    );
  });

  it('gives the collection client the BGG token', () => {
    getSyncService();

    expect(createBggCollectionClient).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'token', userAgent: 'tests' }),
    );
  });

  it('fails naming the variable when the token is missing', () => {
    vi.stubEnv('BGG_API_TOKEN', '');

    expect(() => getSyncService()).toThrow('BGG_API_TOKEN is not set');
  });
});
