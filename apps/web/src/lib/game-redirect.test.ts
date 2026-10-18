import { afterEach, describe, expect, it, vi } from 'vitest';

const { getGameName, logError } = vi.hoisted(() => ({ getGameName: vi.fn(), logError: vi.fn() }));

vi.mock('@meeplewall/db', () => ({ getGameName }));
vi.mock('./services', () => ({ getDatabase: () => 'database' }));
vi.mock('./logger', () => ({ logError }));

const { canonicalGamePath } = await import('./game-redirect');

afterEach(() => {
  vi.resetAllMocks();
});

describe('canonicalGamePath', () => {
  it('adds a missing slug', async () => {
    getGameName.mockResolvedValue('CATAN');

    expect(await canonicalGamePath('/g/13')).toBe('/g/13-catan');
    expect(getGameName).toHaveBeenCalledWith('database', { bggId: 13 });
  });

  it('replaces a stale slug', async () => {
    getGameName.mockResolvedValue('CATAN');

    expect(await canonicalGamePath('/g/13-the-settlers')).toBe('/g/13-catan');
  });

  it('keeps the collection prefix as requested', async () => {
    getGameName.mockResolvedValue('CATAN');

    expect(await canonicalGamePath('/u/first%20last/g/13')).toBe('/u/first%20last/g/13-catan');
  });

  it('is null for a path that is already canonical', async () => {
    getGameName.mockResolvedValue('CATAN');

    expect(await canonicalGamePath('/g/13-catan')).toBeNull();
    expect(await canonicalGamePath('/u/alice/g/13-catan')).toBeNull();
  });

  it('drops a slug when the name leaves nothing behind', async () => {
    getGameName.mockResolvedValue('カタン');

    expect(await canonicalGamePath('/g/13-catan')).toBe('/g/13');
    expect(await canonicalGamePath('/g/13')).toBeNull();
  });

  it.each(['/g/0', '/g/abc', '/g/012-catan'])(
    'is null without a read for the invalid id in %j',
    async (pathname) => {
      expect(await canonicalGamePath(pathname)).toBeNull();
      expect(getGameName).not.toHaveBeenCalled();
    },
  );

  it('is null for an unknown game', async () => {
    getGameName.mockResolvedValue(undefined);

    expect(await canonicalGamePath('/g/404')).toBeNull();
  });

  it('logs a failed read and lets the page render', async () => {
    const error = new Error('connection refused');
    getGameName.mockRejectedValue(error);

    expect(await canonicalGamePath('/g/13')).toBeNull();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ error, fields: { bggId: 13 } }),
    );
  });
});
