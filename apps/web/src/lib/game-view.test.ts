import type { ImageAsset } from '@board-games/db';
import { describe, expect, it } from 'vitest';

import { PLACEHOLDER_COVER_PATH, resolveGameImages, toGameBoxInput } from './game-view';

const PUBLIC_BASE_URL = 'https://cdn.example.com/bucket';
const RAW = {
  imageUrlRaw: 'https://cf.geekdo-images.com/original.jpg',
  thumbUrlRaw: 'https://cf.geekdo-images.com/thumb.jpg',
};

function asset(overrides: Partial<ImageAsset>): ImageAsset {
  return {
    id: 1,
    bggGameId: 13,
    kind: 'cover',
    storageKey: 'covers/13.abc.webp',
    contentType: 'image/webp',
    width: 1024,
    height: 768,
    byteSize: 1_000,
    sideColor: '#aa3322',
    edgeColor: '#221100',
    createdAt: new Date('2026-10-18T00:00:00.000Z'),
    ...overrides,
  };
}

describe('resolveGameImages', () => {
  it('uses the processed assets when both exist', () => {
    const images = resolveGameImages({
      game: RAW,
      assets: [asset({}), asset({ kind: 'thumb', storageKey: 'covers/13.abc.thumb.webp' })],
      publicBaseUrl: PUBLIC_BASE_URL,
    });

    expect(images).toEqual({
      coverUrl: 'https://cdn.example.com/bucket/covers/13.abc.webp',
      thumbUrl: 'https://cdn.example.com/bucket/covers/13.abc.thumb.webp',
      processedCoverUrl: 'https://cdn.example.com/bucket/covers/13.abc.webp',
      originalUrl: RAW.imageUrlRaw,
      sideColor: '#aa3322',
      edgeColor: '#221100',
    });
  });

  it("falls back to BGG's URLs and no colours before anything is processed", () => {
    expect(resolveGameImages({ game: RAW, assets: [], publicBaseUrl: PUBLIC_BASE_URL })).toEqual({
      coverUrl: RAW.imageUrlRaw,
      thumbUrl: RAW.thumbUrlRaw,
      processedCoverUrl: null,
      originalUrl: RAW.imageUrlRaw,
      sideColor: null,
      edgeColor: null,
    });
  });

  it('takes the colours from the thumb when only the thumb is processed', () => {
    const images = resolveGameImages({
      game: RAW,
      assets: [asset({ kind: 'thumb', sideColor: '#010203', edgeColor: '#040506' })],
      publicBaseUrl: PUBLIC_BASE_URL,
    });

    expect(images).toMatchObject({
      coverUrl: RAW.imageUrlRaw,
      processedCoverUrl: null,
      sideColor: '#010203',
      edgeColor: '#040506',
    });
  });

  it('uses the processed cover as the thumb when BGG has no thumb', () => {
    const images = resolveGameImages({
      game: { imageUrlRaw: RAW.imageUrlRaw, thumbUrlRaw: null },
      assets: [asset({})],
      publicBaseUrl: PUBLIC_BASE_URL,
    });

    expect(images.thumbUrl).toBe('https://cdn.example.com/bucket/covers/13.abc.webp');
  });

  it('has no images for a game BGG has no image of', () => {
    const images = resolveGameImages({
      game: { imageUrlRaw: null, thumbUrlRaw: null },
      assets: [],
      publicBaseUrl: PUBLIC_BASE_URL,
    });

    expect(images).toMatchObject({ coverUrl: null, thumbUrl: null });
  });
});

describe('toGameBoxInput', () => {
  const processed = resolveGameImages({
    game: RAW,
    assets: [asset({})],
    publicBaseUrl: PUBLIC_BASE_URL,
  });
  const unprocessed = resolveGameImages({ game: RAW, assets: [], publicBaseUrl: PUBLIC_BASE_URL });

  it('uses the measured box and the processed cover and colours', () => {
    expect(
      toGameBoxInput({
        game: { boxWidthMm: 221, boxHeightMm: 296, boxDepthMm: 70 },
        images: processed,
      }),
    ).toEqual({
      size: { width: 221, height: 296, depth: 70 },
      covers: { front: 'https://cdn.example.com/bucket/covers/13.abc.webp' },
      sideColor: '#aa3322',
      edgeColor: '#221100',
    });
  });

  it('falls back to a standard box, the placeholder front and neutral fills', () => {
    const input = toGameBoxInput({
      game: { boxWidthMm: 221, boxHeightMm: null, boxDepthMm: 70 },
      images: unprocessed,
    });

    expect(input.size).toEqual({ width: 296, height: 296, depth: 72 });
    expect(input.covers.front).toBe(PLACEHOLDER_COVER_PATH);
    expect(input.sideColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(input.edgeColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('never hands the renderer a cross-origin BGG URL', () => {
    const input = toGameBoxInput({
      game: { boxWidthMm: null, boxHeightMm: null, boxDepthMm: null },
      images: unprocessed,
    });

    expect(input.covers.front).not.toContain('geekdo');
  });
});
