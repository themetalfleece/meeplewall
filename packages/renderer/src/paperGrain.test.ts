import { describe, expect, it } from 'vitest';
import { PAPER_GRAIN_SIZE, generatePaperGrain } from './paperGrain.js';

describe('generatePaperGrain', () => {
  it('fills an RGBA tile of the requested size', () => {
    expect(generatePaperGrain(8)).toHaveLength(8 * 8 * 4);
    expect(generatePaperGrain()).toHaveLength(PAPER_GRAIN_SIZE * PAPER_GRAIN_SIZE * 4);
  });

  it('is deterministic', () => {
    expect(generatePaperGrain(16)).toEqual(generatePaperGrain(16));
  });

  it('is greyscale and fully opaque', () => {
    const pixels = generatePaperGrain(16);
    for (let offset = 0; offset < pixels.length; offset += 4) {
      expect(pixels[offset + 1]).toBe(pixels[offset]);
      expect(pixels[offset + 2]).toBe(pixels[offset]);
      expect(pixels[offset + 3]).toBe(255);
    }
  });

  it('has visible variation rather than a flat tile', () => {
    const levels = new Set<number>();
    const pixels = generatePaperGrain(32);
    for (let offset = 0; offset < pixels.length; offset += 4) levels.add(pixels[offset] ?? 0);
    expect(levels.size).toBeGreaterThan(20);
  });

  it.each([0, -4, 2.5])('rejects a %s texel tile', (size) => {
    expect(() => generatePaperGrain(size)).toThrow(RangeError);
  });
});
