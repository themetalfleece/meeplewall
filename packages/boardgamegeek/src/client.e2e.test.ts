import { describe, expect, it } from 'vitest';

import { crossCheckBoxSize } from './box-dimensions.ts';
import { createBggClient } from './client.ts';
import { FIXTURE_GAME_IDS } from './fixtures/fixtures.ts';

// Live calls against api.geekdo.com. Skips when BGG is unreachable, so an offline machine
// reports skipped rather than green.

const USER_AGENT = 'board-games e2e tests (+https://github.com/themetalfleece/board-games)';

async function isGeekdoReachable(): Promise<boolean> {
  try {
    const response = await fetch(
      'https://api.geekdo.com/api/geekitems?objectid=1&objecttype=thing',
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000),
      },
    );

    return response.status < 500;
  } catch {
    return false;
  }
}

const isOnline = await isGeekdoReachable();

describe.skipIf(!isOnline)('BGG client against live geekdo', () => {
  const client = createBggClient({ userAgent: USER_AGENT, requestsPerSecond: 2 });

  it('fetches and parses a game with its stats', async () => {
    const game = await client.fetchGame({ bggId: FIXTURE_GAME_IDS.codenames });

    expect(game).toMatchObject({ bggId: 178900, name: 'Codenames', yearPublished: 2015 });
    expect(game?.designers.map((designer) => designer.name)).toContain('Vlaada Chvátil');
    expect(game?.stats?.rank).toBeGreaterThan(0);
  });

  it('pages through more than 50 versions and sizes the box from them', async () => {
    const versions = await client.fetchGameVersions({ bggId: FIXTURE_GAME_IDS.codenames });

    expect(versions.length).toBeGreaterThan(50);
    expect(new Set(versions.map((version) => version.versionId)).size).toBe(versions.length);
    expect(crossCheckBoxSize({ versions, title: 'Codenames' })?.size.height).toBeGreaterThan(15);
  });

  it('returns null for an id BGG does not know', async () => {
    expect(await client.fetchGame({ bggId: 999_999_999 })).toBeNull();
  });
});
