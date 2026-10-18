import type { BoxFace, BoxSize } from './types.js';

/** Millimetres per world unit. A 310 mm box is 3.1 units tall, the scale the lighting and camera were tuned at. */
export const MILLIMETRES_PER_UNIT = 100;

/** Throws a RangeError stating `requirement` unless `value` is a finite number above zero. */
export function assertPositive({
  value,
  requirement,
}: {
  value: number;
  requirement: string;
}): void {
  if (Number.isFinite(value) && value > 0) return;

  throw new RangeError(`${requirement}, got ${value}`);
}

/** Box dimensions in world units, oriented so the front face is width by height. */
export interface OrientedBox {
  width: number;
  height: number;
  depth: number;
}

/**
 * Orients a box to its cover art. The thinnest dimension is the depth, and the
 * long edge runs horizontally only for a landscape cover, so the art is never
 * squeezed onto a face of the other orientation.
 */
export function orientBox({
  size,
  coverAspect,
}: {
  size: BoxSize;
  coverAspect: number;
}): OrientedBox {
  const dimensions = [size.width, size.height, size.depth];
  for (const dimension of dimensions) {
    assertPositive({
      value: dimension,
      requirement: 'Box dimensions must be positive millimetres',
    });
  }
  assertPositive({ value: coverAspect, requirement: 'Cover aspect must be a positive ratio' });

  const [longest = 0, middle = 0, thinnest = 0] = dimensions.sort(
    (first, second) => second - first,
  );
  const isLandscape = coverAspect >= 1;

  return {
    width: (isLandscape ? longest : middle) / MILLIMETRES_PER_UNIT,
    height: (isLandscape ? middle : longest) / MILLIMETRES_PER_UNIT,
    depth: thinnest / MILLIMETRES_PER_UNIT,
  };
}

/** Width over height of a face as it appears on the box. */
export function faceAspect({ box, face }: { box: OrientedBox; face: BoxFace }): number {
  if (face === 'front' || face === 'back') return box.width / box.height;
  if (face === 'spine') return box.depth / box.height;
  if (face === 'top' || face === 'bottom') return box.width / box.depth;

  const unreachable: never = face;
  throw new Error(`Unhandled box face: ${String(unreachable)}`);
}

/** Corner and edge bevel radius: a subtle rounding in proportion to the box. */
export function bevelRadius(box: OrientedBox): number {
  return Math.min(box.width, box.height, box.depth) * 0.06;
}

/** A UV scale and offset, applied in the shader as `uv * scale + offset`. */
export interface UvTransform {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

export const IDENTITY_UV_TRANSFORM: UvTransform = { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };

/**
 * Centre-crops an image to fill a face of another aspect, the way CSS
 * `object-fit: cover` does, so artwork is cropped rather than stretched.
 */
export function coverFit({
  imageAspect,
  targetAspect,
}: {
  imageAspect: number;
  targetAspect: number;
}): UvTransform {
  if (!(imageAspect > 0) || !(targetAspect > 0)) return IDENTITY_UV_TRANSFORM;

  if (imageAspect > targetAspect) {
    const scaleX = targetAspect / imageAspect;
    return { scaleX, scaleY: 1, offsetX: (1 - scaleX) / 2, offsetY: 0 };
  }

  const scaleY = imageAspect / targetAspect;
  return { scaleX: 1, scaleY, offsetX: 0, offsetY: (1 - scaleY) / 2 };
}
