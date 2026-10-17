import { describe, expect, it } from 'vitest';

import { imageStorageKey } from './worker.ts';

describe('imageStorageKey', () => {
  const data = new Uint8Array([1, 2, 3]);

  it('names a cover by game id and a digest of its bytes', () => {
    expect(imageStorageKey({ bggGameId: 13, kind: 'cover', data })).toMatch(
      /^covers\/13\.[0-9a-f]{16}\.webp$/,
    );
  });

  it('marks a thumb with a .thumb suffix', () => {
    expect(imageStorageKey({ bggGameId: 13, kind: 'thumb', data })).toMatch(
      /^covers\/13\.[0-9a-f]{16}\.thumb\.webp$/,
    );
  });

  it('is stable for the same bytes', () => {
    expect(imageStorageKey({ bggGameId: 13, kind: 'cover', data })).toBe(
      imageStorageKey({ bggGameId: 13, kind: 'cover', data: new Uint8Array([1, 2, 3]) }),
    );
  });

  it('changes when the bytes change, so a cached old image is never served', () => {
    expect(imageStorageKey({ bggGameId: 13, kind: 'cover', data })).not.toBe(
      imageStorageKey({ bggGameId: 13, kind: 'cover', data: new Uint8Array([1, 2, 4]) }),
    );
  });
});
