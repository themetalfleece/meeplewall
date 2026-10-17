import { describe, expect, it } from 'vitest';
import {
  IDENTITY_UV_TRANSFORM,
  MILLIMETRES_PER_UNIT,
  bevelRadius,
  coverFit,
  faceAspect,
  orientBox,
} from './dimensions.js';

describe('orientBox', () => {
  const size = { width: 270, height: 310, depth: 90 };

  it('stands a portrait cover upright with the long edge vertical', () => {
    expect(orientBox({ size, coverAspect: 1200 / 1417 })).toEqual({
      width: 2.7,
      height: 3.1,
      depth: 0.9,
    });
  });

  it('lays a landscape cover flat with the long edge horizontal', () => {
    expect(orientBox({ size, coverAspect: 1417 / 1200 })).toEqual({
      width: 3.1,
      height: 2.7,
      depth: 0.9,
    });
  });

  it('treats a square cover as landscape', () => {
    expect(orientBox({ size, coverAspect: 1 }).width).toBe(3.1);
  });

  it('always uses the thinnest dimension as the depth, whatever order it arrives in', () => {
    const shuffled = { width: 90, height: 270, depth: 310 };
    expect(orientBox({ size: shuffled, coverAspect: 0.8 })).toEqual({
      width: 2.7,
      height: 3.1,
      depth: 0.9,
    });
  });

  it('does not reorder the caller’s size object', () => {
    const input = { width: 90, height: 310, depth: 270 };
    orientBox({ size: input, coverAspect: 1 });
    expect(input).toEqual({ width: 90, height: 310, depth: 270 });
  });

  it('converts millimetres to world units', () => {
    const cube = {
      width: MILLIMETRES_PER_UNIT,
      height: MILLIMETRES_PER_UNIT,
      depth: MILLIMETRES_PER_UNIT,
    };
    expect(orientBox({ size: cube, coverAspect: 1 })).toEqual({ width: 1, height: 1, depth: 1 });
  });

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])('rejects a %s mm dimension', (bad) => {
    expect(() => orientBox({ size: { ...size, depth: bad }, coverAspect: 1 })).toThrow(RangeError);
  });

  it.each([0, -1, Number.NaN])('rejects a %s cover aspect', (bad) => {
    expect(() => orientBox({ size, coverAspect: bad })).toThrow(RangeError);
  });
});

describe('faceAspect', () => {
  const box = { width: 3, height: 2, depth: 0.5 };

  it('measures the front and back as width over height', () => {
    expect(faceAspect({ box, face: 'front' })).toBe(1.5);
    expect(faceAspect({ box, face: 'back' })).toBe(1.5);
  });

  it('measures the spine as depth over height', () => {
    expect(faceAspect({ box, face: 'spine' })).toBe(0.25);
  });

  it('measures the top and bottom as width over depth', () => {
    expect(faceAspect({ box, face: 'top' })).toBe(6);
    expect(faceAspect({ box, face: 'bottom' })).toBe(6);
  });

  it('throws on a face outside the union', () => {
    // @ts-expect-error: an unknown face is the point of this test
    expect(() => faceAspect({ box, face: 'side' })).toThrow('Unhandled box face');
  });
});

describe('bevelRadius', () => {
  it('scales with the thinnest dimension', () => {
    expect(bevelRadius({ width: 3, height: 2, depth: 0.5 })).toBeCloseTo(0.03);
  });
});

describe('coverFit', () => {
  it('leaves a matching image untouched', () => {
    expect(coverFit({ imageAspect: 1.5, targetAspect: 1.5 })).toEqual(IDENTITY_UV_TRANSFORM);
  });

  it('crops the sides of an image wider than the face, keeping it centred', () => {
    const fit = coverFit({ imageAspect: 2, targetAspect: 1 });
    expect(fit).toEqual({ scaleX: 0.5, scaleY: 1, offsetX: 0.25, offsetY: 0 });
  });

  it('crops the top and bottom of an image taller than the face, keeping it centred', () => {
    const fit = coverFit({ imageAspect: 0.5, targetAspect: 1 });
    expect(fit).toEqual({ scaleX: 1, scaleY: 0.5, offsetX: 0, offsetY: 0.25 });
  });

  it('keeps the sampled window inside the image', () => {
    const fit = coverFit({ imageAspect: 0.7, targetAspect: 6 });
    expect(fit.offsetY).toBeGreaterThanOrEqual(0);
    expect(fit.offsetY + fit.scaleY).toBeCloseTo(1 - fit.offsetY);
  });

  it.each([
    [0, 1],
    [1, 0],
    [Number.NaN, 1],
  ])('falls back to the identity for a degenerate %s or %s aspect', (imageAspect, targetAspect) => {
    expect(coverFit({ imageAspect, targetAspect })).toEqual(IDENTITY_UV_TRANSFORM);
  });
});
