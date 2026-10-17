import { readFile } from 'node:fs/promises';

/**
 * Real covers copied from apps/web-legacy/public/covers/, with the dimensions
 * and colours the legacy texture script produced for them (games.json).
 */
export const COVER_FIXTURES = {
  // A JPEG taller than the cover tier, so both tiers scale down.
  beaconPatrol: {
    file: 'beacon-patrol-362976.jpg',
    format: 'jpeg',
    width: 650,
    height: 1220,
    sideColor: '#88d8f8',
    edgeColor: '#528295',
  },
  // A PNG smaller than the cover tier, so the cover keeps its size. Its centre is dominated by
  // near black, so the side colour comes from the average.
  fantasyRealms: {
    file: 'fantasy-realms-deluxe-edition-363289.png',
    format: 'png',
    width: 390,
    height: 552,
    sideColor: '#9c5f68',
    edgeColor: '#5e393e',
  },
} as const;

export type CoverFixture = (typeof COVER_FIXTURES)[keyof typeof COVER_FIXTURES];

export async function readCoverFixture(fixture: CoverFixture): Promise<Buffer> {
  return readFile(new URL(fixture.file, import.meta.url));
}
