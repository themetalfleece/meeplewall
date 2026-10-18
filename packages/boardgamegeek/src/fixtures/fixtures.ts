import { readFileSync } from 'node:fs';

import { z } from 'zod';

// Real geekdo responses, copied from the legacy pipeline's BGG cache and wrapped back in the
// envelope each endpoint returns (`item` for geekitems and dynamicinfo, `items` for versions).

export const FIXTURE_GAME_IDS = {
  codenames: 178900,
  celts: 40832,
  fantasyRealmsDeluxe: 363289,
  skullQueen: 423432,
  wizWar: 324937,
} as const;

export type FixtureEndpoint = 'geekitems' | 'dynamicinfo' | 'versions';

/** The raw response body, exactly as served. */
export function readFixture({
  bggId,
  endpoint,
}: {
  bggId: number;
  endpoint: FixtureEndpoint;
}): string {
  return readFileSync(new URL(`./${bggId}/${endpoint}.json`, import.meta.url), 'utf8');
}

/**
 * An XMLAPI2 collection in the documented response shape, covering an owned game, a
 * want-to-play game, a previously owned wishlist game and an unrated one.
 */
export function readCollectionFixture(): string {
  return readFileSync(new URL('./collection.xml', import.meta.url), 'utf8');
}

const legacyBoxesSchema = z.record(
  z.string(),
  z.object({
    title: z.string(),
    size: z.object({ w: z.number(), h: z.number(), d: z.number() }),
    source: z.string(),
    agreement: z.number(),
    versionsWithDimensions: z.number(),
  }),
);

/** What the legacy enrichment step computed for each fixture game, from its report. */
export function readLegacyBoxes(): z.output<typeof legacyBoxesSchema> {
  return legacyBoxesSchema.parse(
    JSON.parse(readFileSync(new URL('./legacy-boxes.json', import.meta.url), 'utf8')),
  );
}
