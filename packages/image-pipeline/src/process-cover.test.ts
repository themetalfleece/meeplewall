import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { COVER_FIXTURES, readCoverFixture, type CoverFixture } from './fixtures/covers.ts';
import { processCover, type EncodedImage } from './process-cover.ts';

async function expectWebp({ image }: { image: EncodedImage }) {
  const metadata = await sharp(image.data).metadata();

  expect(image.contentType).toBe('image/webp');
  expect(metadata.format).toBe('webp');
  expect({ width: metadata.width, height: metadata.height }).toEqual({
    width: image.width,
    height: image.height,
  });
}

function expectScaledFrom({
  image,
  fixture,
  longSide,
}: {
  image: EncodedImage;
  fixture: CoverFixture;
  longSide: number;
}) {
  const scale = Math.min(1, longSide / Math.max(fixture.width, fixture.height));

  expect(Math.abs(image.width - fixture.width * scale)).toBeLessThanOrEqual(1);
  expect(Math.abs(image.height - fixture.height * scale)).toBeLessThanOrEqual(1);
}

describe('processCover', () => {
  it('scales a large cover down to both tiers as WebP', async () => {
    const fixture = COVER_FIXTURES.beaconPatrol;

    const processed = await processCover({ input: await readCoverFixture(fixture) });

    await expectWebp({ image: processed.cover });
    await expectWebp({ image: processed.thumb });
    expect(processed.cover.height).toBe(1024);
    expect(processed.thumb.height).toBe(320);
    expectScaledFrom({ image: processed.cover, fixture, longSide: 1024 });
    expectScaledFrom({ image: processed.thumb, fixture, longSide: 320 });
  });

  it('keeps a cover smaller than the cover tier at its own size', async () => {
    const fixture = COVER_FIXTURES.fantasyRealms;

    const processed = await processCover({ input: await readCoverFixture(fixture) });

    await expectWebp({ image: processed.cover });
    expect({ width: processed.cover.width, height: processed.cover.height }).toEqual({
      width: fixture.width,
      height: fixture.height,
    });
    expect(processed.thumb.height).toBe(320);
    expectScaledFrom({ image: processed.thumb, fixture, longSide: 320 });
  });

  it('includes the sampled cover colours', async () => {
    const fixture = COVER_FIXTURES.beaconPatrol;

    const processed = await processCover({ input: await readCoverFixture(fixture) });

    expect(processed.sideColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(processed.edgeColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('applies the EXIF orientation before sizing', async () => {
    // Stored 400 wide by 200 tall; orientation 6 means it displays rotated a quarter turn.
    const sideways = await sharp({
      create: { width: 400, height: 200, channels: 3, background: '#3366cc' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const processed = await processCover({ input: sideways });

    expect({ width: processed.cover.width, height: processed.cover.height }).toEqual({
      width: 200,
      height: 400,
    });
    expect({ width: processed.thumb.width, height: processed.thumb.height }).toEqual({
      width: 160,
      height: 320,
    });
  });

  it('rejects input that is not an image', async () => {
    await expect(processCover({ input: Buffer.from('<html>Not found</html>') })).rejects.toThrow();
  });

  it('rejects an empty input', async () => {
    await expect(processCover({ input: new Uint8Array() })).rejects.toThrow();
  });
});
