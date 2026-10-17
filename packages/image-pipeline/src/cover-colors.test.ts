import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { sampleCoverColors } from './cover-colors.ts';
import { COVER_FIXTURES, readCoverFixture } from './fixtures/covers.ts';

function channels(hex: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function expectColorNear({
  actual,
  expected,
  tolerance,
}: {
  actual: string;
  expected: string;
  tolerance: number;
}) {
  expect(actual).toMatch(/^#[0-9a-f]{6}$/);
  const expectedChannels = channels(expected);
  const distances = channels(actual).map((value, index) =>
    Math.abs(value - (expectedChannels[index] ?? Number.NaN)),
  );

  expect(
    Math.max(...distances),
    `${actual} is not within ${tolerance} of ${expected}`,
  ).toBeLessThanOrEqual(tolerance);
}

function solidImage({ width, height, color }: { width: number; height: number; color: string }) {
  return sharp({ create: { width, height, channels: 3, background: color } });
}

/** A `background` image with a `centerColor` square covering its middle 60%. */
async function framedImage({
  background,
  centerColor,
}: {
  background: string;
  centerColor: string;
}) {
  const center = await solidImage({ width: 60, height: 60, color: centerColor }).png().toBuffer();

  return solidImage({ width: 100, height: 100, color: background })
    .composite([{ input: center, left: 20, top: 20 }])
    .png()
    .toBuffer();
}

describe('sampleCoverColors', () => {
  it('matches the legacy colours of a cover whose centre has a clear dominant colour', async () => {
    const fixture = COVER_FIXTURES.beaconPatrol;

    const colors = await sampleCoverColors({ input: await readCoverFixture(fixture) });

    expectColorNear({ actual: colors.sideColor, expected: fixture.sideColor, tolerance: 4 });
    expectColorNear({ actual: colors.edgeColor, expected: fixture.edgeColor, tolerance: 4 });
  });

  it('stays near the legacy colours when the average decides', async () => {
    const fixture = COVER_FIXTURES.fantasyRealms;

    const colors = await sampleCoverColors({ input: await readCoverFixture(fixture) });

    // The legacy script averaged with a 1x1 resize, which weights the middle pixels; this takes
    // the exact mean of the sampled region, so the two land close but not on the same value.
    expectColorNear({ actual: colors.sideColor, expected: fixture.sideColor, tolerance: 12 });
    expectColorNear({ actual: colors.edgeColor, expected: fixture.edgeColor, tolerance: 12 });
  });

  it('ignores a white border around the art', async () => {
    const input = await framedImage({ background: '#ffffff', centerColor: '#cc3322' });

    const colors = await sampleCoverColors({ input });

    expectColorNear({ actual: colors.sideColor, expected: '#cc3322', tolerance: 8 });
  });

  it('darkens the side colour by 40% for the edge colour', async () => {
    const input = await solidImage({ width: 50, height: 50, color: '#c08040' }).png().toBuffer();

    const colors = await sampleCoverColors({ input });

    const side = channels(colors.sideColor);
    expectColorNear({
      actual: colors.edgeColor,
      expected: `#${side
        .map((value) =>
          Math.round(value * 0.6)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')}`,
      tolerance: 1,
    });
  });

  it('falls back to the average when the dominant colour is near white', async () => {
    // Mostly white with a blue band, so white wins the histogram but the mean is light blue.
    const band = await solidImage({ width: 100, height: 30, color: '#2040c0' }).png().toBuffer();
    const input = await solidImage({ width: 100, height: 100, color: '#ffffff' })
      .composite([{ input: band, left: 0, top: 35 }])
      .png()
      .toBuffer();

    const colors = await sampleCoverColors({ input });

    expect(colors.sideColor).not.toBe('#ffffff');
    const [red, green, blue] = channels(colors.sideColor);
    expect(blue).toBeGreaterThan(red ?? Number.NaN);
    expect(blue).toBeGreaterThan(green ?? Number.NaN);
  });

  it('falls back to a neutral slate when the cover is entirely near black', async () => {
    const input = await solidImage({ width: 50, height: 50, color: '#050505' }).png().toBuffer();

    const colors = await sampleCoverColors({ input });

    expect(colors).toEqual({ sideColor: '#5a5c62', edgeColor: '#36373b' });
  });

  it('samples a greyscale image', async () => {
    const input = await solidImage({ width: 50, height: 50, color: '#808080' })
      .toColourspace('b-w')
      .png()
      .toBuffer();
    expect((await sharp(input).metadata()).channels).toBe(1);

    const colors = await sampleCoverColors({ input });

    expectColorNear({ actual: colors.sideColor, expected: '#808080', tolerance: 8 });
  });

  it('treats transparent pixels as white rather than their hidden colour', async () => {
    const input = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();

    const colors = await sampleCoverColors({ input });

    expect(colors.sideColor).toBe('#5a5c62');
  });

  it('samples a 1x1 image', async () => {
    const input = await solidImage({ width: 1, height: 1, color: '#336699' }).png().toBuffer();

    const colors = await sampleCoverColors({ input });

    expectColorNear({ actual: colors.sideColor, expected: '#336699', tolerance: 8 });
  });

  it('rejects input that is not an image', async () => {
    await expect(sampleCoverColors({ input: Buffer.from('not an image') })).rejects.toThrow();
  });
});
