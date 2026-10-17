import { describe, expect, it } from 'vitest';

import { crossCheckBoxSize, normaliseToCentimetres } from './box-dimensions.ts';
import { FIXTURE_GAME_IDS, readFixture, readLegacyBoxes } from './fixtures/fixtures.ts';
import { gameVersionsPageResponseSchema } from './schemas.ts';
import type { BggGameVersion } from './schemas.ts';

function fixtureVersions(bggId: number): BggGameVersion[] {
  const body: unknown = JSON.parse(readFixture({ bggId, endpoint: 'versions' }));

  return gameVersionsPageResponseSchema.parse(body).versions;
}

function version({
  name,
  dimensions,
}: {
  name: string;
  dimensions: BggGameVersion['dimensions'];
}): BggGameVersion {
  return {
    versionId: 1,
    name,
    yearPublished: null,
    dimensions,
    publishers: [],
    languages: [],
  };
}

describe('normaliseToCentimetres', () => {
  it('reads a box whose largest side is 15 or less as inches', () => {
    expect(normaliseToCentimetres({ length: 10, width: 8, depth: 2 })).toEqual({
      width: 8 * 2.54,
      height: 10 * 2.54,
      depth: 2 * 2.54,
    });
  });

  it('keeps a box whose largest side is over 15 in centimetres', () => {
    expect(normaliseToCentimetres({ length: 29.5, width: 29.5, depth: 7 })).toEqual({
      width: 29.5,
      height: 29.5,
      depth: 7,
    });
  });

  it('treats exactly 15 as inches', () => {
    expect(normaliseToCentimetres({ length: 15, width: 15, depth: 3 }).height).toBeCloseTo(38.1);
  });

  it('puts the longer face side in height whichever field it came in', () => {
    expect(normaliseToCentimetres({ length: 20, width: 30, depth: 5 })).toEqual({
      width: 20,
      height: 30,
      depth: 5,
    });
  });
});

describe('crossCheckBoxSize', () => {
  const legacyBoxes = Object.entries(readLegacyBoxes()).filter(
    ([, legacy]) => legacy.source !== 'estimated',
  );

  it.each(legacyBoxes)('matches the legacy enrichment for game %s', (bggId, legacy) => {
    const estimate = crossCheckBoxSize({
      versions: fixtureVersions(Number(bggId)),
      title: legacy.title,
    });

    expect(estimate).toMatchObject({
      size: { width: legacy.size.w, height: legacy.size.h, depth: legacy.size.d },
      source: legacy.source,
      agreement: legacy.agreement,
      versionsWithDimensions: legacy.versionsWithDimensions,
    });
  });

  it('returns null for a game whose versions carry no dimensions', () => {
    expect(
      crossCheckBoxSize({ versions: fixtureVersions(FIXTURE_GAME_IDS.wizWar), title: 'Wiz-War' }),
    ).toBeNull();
  });

  it('returns null for a game with no versions', () => {
    expect(crossCheckBoxSize({ versions: [], title: 'Anything' })).toBeNull();
  });

  it('drops a unit-misentered outlier from the median', () => {
    const estimate = crossCheckBoxSize({
      title: 'Game',
      versions: [
        version({ name: 'English', dimensions: { length: 30, width: 30, depth: 7 } }),
        version({ name: 'German', dimensions: { length: 30.2, width: 30, depth: 7 } }),
        version({ name: 'French', dimensions: { length: 29.8, width: 30, depth: 7 } }),
        version({ name: 'Mistyped', dimensions: { length: 300, width: 300, depth: 70 } }),
      ],
    });

    expect(estimate).toMatchObject({
      size: { height: 30, width: 30, depth: 7 },
      versionsUsed: 3,
      versionsWithDimensions: 4,
    });
  });

  it('ignores size-variant editions for a standard title', () => {
    const estimate = crossCheckBoxSize({
      title: 'Game',
      versions: [
        version({ name: 'English', dimensions: { length: 30, width: 30, depth: 7 } }),
        version({ name: 'Game XXL', dimensions: { length: 40, width: 40, depth: 10 } }),
      ],
    });

    expect(estimate).toMatchObject({ source: 'bgg-median', versionsUsed: 1, agreement: 1 });
  });

  it('falls back to every edition when all of them are size variants', () => {
    const estimate = crossCheckBoxSize({
      title: 'Game',
      versions: [
        version({ name: 'Game Deluxe', dimensions: { length: 40, width: 40, depth: 10 } }),
      ],
    });

    expect(estimate).toMatchObject({ source: 'bgg-median', size: { height: 40 } });
  });

  it('uses the standard editions when a variant title has no matching edition', () => {
    const estimate = crossCheckBoxSize({
      title: 'Game Mini',
      versions: [version({ name: 'English', dimensions: { length: 30, width: 30, depth: 7 } })],
    });

    expect(estimate).toMatchObject({ source: 'bgg-median', size: { height: 30 } });
  });

  it('prefers Greek editions for a Greek title', () => {
    const estimate = crossCheckBoxSize({
      title: 'Κέλτες',
      versions: [
        version({ name: 'English', dimensions: { length: 30, width: 30, depth: 7 } }),
        version({ name: 'Kaissa edition', dimensions: { length: 20, width: 20, depth: 5 } }),
      ],
    });

    expect(estimate).toMatchObject({ source: 'bgg-greek-edition', size: { height: 20 } });
  });

  it('scores agreement below 1 when the used editions differ', () => {
    const estimate = crossCheckBoxSize({
      title: 'Game',
      versions: [
        version({ name: 'First', dimensions: { length: 20, width: 20, depth: 5 } }),
        version({ name: 'Second', dimensions: { length: 22, width: 20, depth: 5 } }),
      ],
    });

    expect(estimate?.agreement).toBe(0.9);
  });
});
