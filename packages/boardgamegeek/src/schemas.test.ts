import { describe, expect, it } from 'vitest';

import { FIXTURE_GAME_IDS, readFixture } from './fixtures/fixtures.ts';
import type { FixtureEndpoint } from './fixtures/fixtures.ts';
import {
  gameItemResponseSchema,
  gameStatsResponseSchema,
  gameVersionsPageResponseSchema,
} from './schemas.ts';

function fixtureBody({ bggId, endpoint }: { bggId: number; endpoint: FixtureEndpoint }): unknown {
  const body: unknown = JSON.parse(readFixture({ bggId, endpoint }));

  return body;
}

describe('gameItemResponseSchema', () => {
  it('parses a real geekitems response into the public shape', () => {
    const item = gameItemResponseSchema.parse(
      fixtureBody({ bggId: FIXTURE_GAME_IDS.codenames, endpoint: 'geekitems' }),
    );

    expect(item).toMatchObject({
      bggId: 178900,
      name: 'Codenames',
      yearPublished: 2015,
      players: { min: 2, max: 8 },
      playTime: { min: 15, max: 15 },
      minAge: 10,
    });
    expect(item.designers).toContainEqual({ id: 789, name: 'Vlaada Chvátil' });
    expect(item.categories.length).toBeGreaterThan(0);
    expect(item.imageUrl).toMatch(/^https:\/\/cf\.geekdo-images\.com\//);
    expect(item.description).not.toMatch(/<[a-z/]/i);
    expect(item.description.length).toBeGreaterThan(0);
  });

  it('reads 0 and empty strings as unknown', () => {
    const item = gameItemResponseSchema.parse({
      item: {
        objectid: '1',
        name: 'Unknown',
        yearpublished: '0',
        minplayers: '',
        maxplayers: null,
        links: {},
      },
    });

    expect(item).toMatchObject({
      yearPublished: null,
      players: { min: null, max: null },
      playTime: { min: null, max: null },
      minAge: null,
      shortDescription: '',
      description: '',
      imageUrl: null,
      designers: [],
    });
  });

  it('rejects a body without an item', () => {
    expect(gameItemResponseSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('rejects an item whose id is not a positive integer', () => {
    expect(
      gameItemResponseSchema.safeParse({ item: { objectid: 'abc', name: 'Bad', links: {} } })
        .success,
    ).toBe(false);
  });
});

describe('gameStatsResponseSchema', () => {
  it('parses a real dynamicinfo response', () => {
    const stats = gameStatsResponseSchema.parse(
      fixtureBody({ bggId: FIXTURE_GAME_IDS.codenames, endpoint: 'dynamicinfo' }),
    );

    expect(stats).toEqual({
      averageRating: 7.52414,
      ratingCount: 104627,
      weight: 1.254,
      weightCount: 2598,
      rank: 161,
    });
  });

  it('reads an unranked game as a null rank', () => {
    const stats = gameStatsResponseSchema.parse({
      item: {
        stats: { average: '0', usersrated: '0', avgweight: '0', numweights: '0' },
        rankinfo: [{ rank: 'Not Ranked' }],
      },
    });

    expect(stats).toEqual({
      averageRating: null,
      ratingCount: 0,
      weight: null,
      weightCount: 0,
      rank: null,
    });
  });

  it('reads a game with no rank entries as a null rank', () => {
    const stats = gameStatsResponseSchema.parse({
      item: {
        stats: { average: '7', usersrated: '3', avgweight: '2', numweights: '1' },
        rankinfo: [],
      },
    });

    expect(stats.rank).toBeNull();
  });
});

describe('gameVersionsPageResponseSchema', () => {
  it('parses a real versions page', () => {
    const page = gameVersionsPageResponseSchema.parse(
      fixtureBody({ bggId: FIXTURE_GAME_IDS.codenames, endpoint: 'versions' }),
    );

    expect(page.versions).toHaveLength(50);
    expect(page.totalCount).toBeNull();
    expect(page.versions.some((version) => version.dimensions === null)).toBe(true);
    expect(page.versions.find((version) => version.versionId === 803120)).toMatchObject({
      name: 'Codenames XXL (German edition 2026)',
      yearPublished: 2026,
      dimensions: { length: 27.5, width: 19.1, depth: 6.5 },
      languages: [{ id: 2188, name: 'German' }],
    });
  });

  it('reads the total count from config', () => {
    const page = gameVersionsPageResponseSchema.parse({ items: [], config: { numitems: '95' } });

    expect(page).toEqual({ versions: [], totalCount: 95 });
  });

  it('leaves dimensions null when any side is missing', () => {
    const page = gameVersionsPageResponseSchema.parse({
      items: [{ objectid: '5', name: 'Partial', length: '10', width: '0', depth: '2' }],
    });

    expect(page.versions[0]?.dimensions).toBeNull();
  });
});
