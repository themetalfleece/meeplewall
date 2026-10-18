import { MILLIMETRES_PER_UNIT, orientBox, type OrientedBox } from './dimensions.js';
import type {
  BoxSize,
  GameBoxInput,
  HangHole,
  HangTab,
  LidCrop,
  PackageArtwork,
  PackageShape,
} from './types.js';

const DEFAULT_TIN_CORNER_RADIUS = 0.07;
const DEFAULT_TAB_CORNER_RADIUS = 0.28;
const MIN_TAB_THICKNESS = 0.03;
const FOIL_PUFF = 0.18;
const POUCH_PUFF = 0.22;
const FULL_LID: LidCrop = { centerX: 0.5, centerY: 0.5, radius: 0.5 };

/** A hang tab in world units, standing on the box's top face. */
export interface HangTabLayout {
  width: number;
  artWidth: number;
  height: number;
  thickness: number;
  cornerRadius: number;
  hole: HangHole | null;
}

/** A texture repeat and offset about the image centre, in three.js `Texture` terms. */
export interface TextureTransform {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
}

/** Everything a package mesh is built from, in world units. */
export type PackageLayout =
  | { kind: 'box'; box: OrientedBox; hangTab: HangTabLayout | null }
  | { kind: 'rect-tin'; box: OrientedBox; cornerRadius: number }
  | { kind: 'round-tin'; radius: number; height: number; lid: TextureTransform }
  | { kind: 'tube'; radius: number; height: number }
  | { kind: 'foil-bag'; width: number; height: number; puff: number }
  | {
      kind: 'pouch';
      width: number;
      height: number;
      puff: number;
      points: ReadonlyArray<readonly [number, number]>;
    };

/** Every artwork key, in the order load failures are reported. */
export const PACKAGE_ARTWORKS: readonly PackageArtwork[] = [
  'front',
  'back',
  'spine',
  'top',
  'bottom',
  'hangTab',
];

const BOX_SHAPE: PackageShape = { kind: 'box' };

/** The game's package shape, a plain box when it has none. */
export function shapeOf(game: Pick<GameBoxInput, 'shape'>): PackageShape {
  return game.shape ?? BOX_SHAPE;
}

/** Sizes a package in world units. Box-like shapes orient to the cover; cylinders use their own dimensions. */
export function layoutPackage({
  shape,
  size,
  coverAspect,
}: {
  shape: PackageShape;
  size: BoxSize;
  coverAspect: number;
}): PackageLayout {
  if (shape.kind === 'box') {
    const box = orientBox({ size, coverAspect });
    return {
      kind: 'box',
      box,
      hangTab: shape.hangTab ? layoutHangTab({ box, tab: shape.hangTab }) : null,
    };
  }
  if (shape.kind === 'rect-tin') {
    const box = orientBox({ size, coverAspect });
    return { kind: 'rect-tin', box, cornerRadius: shape.cornerRadius ?? DEFAULT_TIN_CORNER_RADIUS };
  }
  if (shape.kind === 'round-tin') {
    return {
      kind: 'round-tin',
      ...cylinderUnits(shape),
      lid: lidTextureTransform(shape.label === undefined ? shape.lidCrop : undefined),
    };
  }
  if (shape.kind === 'tube') return { kind: 'tube', ...cylinderUnits(shape) };
  if (shape.kind === 'foil-bag') {
    const { width, height } = orientBox({ size, coverAspect });
    return { kind: 'foil-bag', width, height, puff: Math.min(width, height) * FOIL_PUFF };
  }
  if (shape.kind === 'pouch') {
    const { aspect, points } = shape.outline;
    if (!Number.isFinite(aspect) || aspect <= 0) {
      throw new RangeError(`Pouch aspect must be a positive ratio, got ${aspect}`);
    }

    const { width } = orientBox({ size, coverAspect });
    const height = width / aspect;
    return { kind: 'pouch', width, height, puff: Math.min(width, height) * POUCH_PUFF, points };
  }

  const unreachable: never = shape;
  throw new Error(`Unhandled package shape: ${String(unreachable)}`);
}

function layoutHangTab({ box, tab }: { box: OrientedBox; tab: HangTab }): HangTabLayout {
  return {
    width: box.width * (tab.widthFraction ?? 1),
    artWidth: box.width,
    height: box.height * tab.heightFraction,
    thickness: Math.max(box.depth * 0.12, MIN_TAB_THICKNESS),
    cornerRadius: tab.cornerRadius ?? DEFAULT_TAB_CORNER_RADIUS,
    hole: tab.hole ?? null,
  };
}

function cylinderUnits({ diameter, height }: { diameter: number; height: number }): {
  radius: number;
  height: number;
} {
  for (const dimension of [diameter, height]) {
    if (!Number.isFinite(dimension) || dimension <= 0) {
      throw new RangeError(`Cylinder dimensions must be positive millimetres, got ${dimension}`);
    }
  }

  return { radius: diameter / 2 / MILLIMETRES_PER_UNIT, height: height / MILLIMETRES_PER_UNIT };
}

/**
 * Maps a lid's circle in an image onto the tin's round cap. The cap's texture
 * up runs to world down once the lid is turned to face the camera, so v is flipped.
 */
export function lidTextureTransform(crop: LidCrop = FULL_LID): TextureTransform {
  return {
    repeatX: 2 * crop.radius,
    repeatY: -2 * crop.radius,
    offsetX: crop.centerX - 0.5,
    offsetY: 0.5 - crop.centerY,
  };
}

/** Half the package's vertical extent, where the shadow floor sits below the centre. */
export function packageHalfHeight(layout: PackageLayout): number {
  if (layout.kind === 'box' || layout.kind === 'rect-tin') return layout.box.height / 2;
  // The tin lies on its side with the lid to the camera; the tube stands upright.
  if (layout.kind === 'round-tin') return layout.radius;
  if (layout.kind === 'tube' || layout.kind === 'foil-bag' || layout.kind === 'pouch') {
    return layout.height / 2;
  }

  const unreachable: never = layout;
  throw new Error(`Unhandled package layout: ${String(unreachable)}`);
}

/** The images a game's package draws, keyed by what each one paints. */
export function artworkUrls(game: GameBoxInput): Partial<Record<PackageArtwork, string>> {
  const shape = shapeOf(game);
  if (shape.kind === 'box') return withHangTab({ urls: { ...game.covers }, tab: shape.hangTab });
  if (shape.kind === 'rect-tin') return { ...game.covers };
  if (shape.kind === 'round-tin' || shape.kind === 'tube') {
    return { front: shape.label ?? game.covers.front };
  }
  if (shape.kind === 'foil-bag') return { front: game.covers.front };
  if (shape.kind === 'pouch') return { front: shape.cutout };

  const unreachable: never = shape;
  throw new Error(`Unhandled package shape: ${String(unreachable)}`);
}

function withHangTab({
  urls,
  tab,
}: {
  urls: Partial<Record<PackageArtwork, string>>;
  tab: HangTab | undefined;
}): Partial<Record<PackageArtwork, string>> {
  if (tab) urls.hangTab = tab.url;
  return urls;
}
