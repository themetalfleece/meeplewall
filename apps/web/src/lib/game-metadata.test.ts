import { afterEach, describe, expect, it, vi } from 'vitest';

const { loadGame } = vi.hoisted(() => ({ loadGame: vi.fn() }));

vi.mock('./games', () => ({ loadGame }));

const { gameMetadata } = await import('./game-metadata');

afterEach(() => {
  vi.resetAllMocks();
});

describe('gameMetadata', () => {
  it('titles a game page and points its canonical URL at /g', async () => {
    loadGame.mockResolvedValue({ name: 'CATAN', description: 'Trade and build.' });

    expect(await gameMetadata({ segment: '13', username: null })).toEqual({
      title: 'CATAN',
      description: 'Trade and build.',
      alternates: { canonical: '/g/13' },
      openGraph: { title: 'CATAN', type: 'website' },
    });
  });

  it('names the collection in the title but keeps the canonical URL at /g', async () => {
    loadGame.mockResolvedValue({ name: 'CATAN', description: null });

    const metadata = await gameMetadata({ segment: '13', username: 'alice' });

    expect(metadata.title).toBe("CATAN in alice's collection");
    expect(metadata.alternates?.canonical).toBe('/g/13');
    expect(metadata.description).toBe('CATAN on BoardGameGeek, as a 3D box.');
  });

  it('shortens a long description', async () => {
    loadGame.mockResolvedValue({ name: 'Long', description: 'word '.repeat(100) });

    const { description } = await gameMetadata({ segment: '13', username: null });

    expect(description?.length).toBeLessThanOrEqual(200);
    expect(description?.endsWith('…')).toBe(true);
  });

  it.each(['0', 'abc'])('marks an invalid id %j as not found without a read', async (segment) => {
    expect(await gameMetadata({ segment, username: null })).toMatchObject({
      robots: { index: false },
    });
    expect(loadGame).not.toHaveBeenCalled();
  });

  it('marks an unknown game as not found', async () => {
    loadGame.mockResolvedValue(null);

    expect((await gameMetadata({ segment: '404', username: null })).title).toBe('Game not found');
  });
});
