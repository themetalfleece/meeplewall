import { describe, expect, it } from 'vitest';
import {
  artworkUrls,
  layoutPackage,
  lidTextureTransform,
  packageHalfHeight,
  shapeOf,
  type PackageLayout,
} from './packageLayout.js';
import type { GameBoxInput, PackageShape } from './types.js';

const size = { width: 102, height: 143, depth: 38 };
const portrait = 0.7;

const game: GameBoxInput = {
  size,
  covers: { front: '/g/cover.webp', back: '/g/back.webp' },
  sideColor: '#181818',
  edgeColor: '#0e0e0e',
};

function layout(shape: PackageShape): PackageLayout {
  return layoutPackage({ shape, size, coverAspect: portrait });
}

describe('shapeOf', () => {
  it('defaults to a plain box', () => {
    expect(shapeOf({})).toEqual({ kind: 'box' });
  });

  it('keeps a declared shape', () => {
    expect(shapeOf({ shape: { kind: 'foil-bag' } })).toEqual({ kind: 'foil-bag' });
  });
});

describe('layoutPackage', () => {
  it('orients a box to its cover and has no hang tab by default', () => {
    expect(layout({ kind: 'box' })).toEqual({
      kind: 'box',
      box: { width: 1.02, height: 1.43, depth: 0.38 },
      hangTab: null,
    });
  });

  it('sizes a hang tab from the box, with defaults for the optional fields', () => {
    const result = layout({ kind: 'box', hangTab: { url: '/tab.webp', heightFraction: 0.2 } });
    if (result.kind !== 'box') throw new Error('Expected a box layout');

    expect(result.hangTab?.width).toBeCloseTo(1.02);
    expect(result.hangTab?.artWidth).toBeCloseTo(1.02);
    expect(result.hangTab?.height).toBeCloseTo(0.286);
    expect(result.hangTab?.thickness).toBeCloseTo(0.0456);
    expect(result.hangTab?.cornerRadius).toBe(0.28);
    expect(result.hangTab?.hole).toBeNull();
  });

  it('narrows a hang tab and keeps a minimum thickness on a thin box', () => {
    const thin = layoutPackage({
      shape: {
        kind: 'box',
        hangTab: { url: '/tab.webp', heightFraction: 0.2, widthFraction: 0.5 },
      },
      size: { width: 94, height: 127, depth: 20 },
      coverAspect: portrait,
    });
    if (thin.kind !== 'box') throw new Error('Expected a box layout');

    expect(thin.hangTab?.width).toBeCloseTo(0.47);
    expect(thin.hangTab?.artWidth).toBeCloseTo(0.94);
    expect(thin.hangTab?.thickness).toBe(0.03);
  });

  it('gives a rectangular tin a default corner radius', () => {
    expect(layout({ kind: 'rect-tin' })).toMatchObject({ kind: 'rect-tin', cornerRadius: 0.07 });
    expect(layout({ kind: 'rect-tin', cornerRadius: 0.16 })).toMatchObject({ cornerRadius: 0.16 });
  });

  it('sizes a tube from its own dimensions, ignoring the box size', () => {
    expect(layout({ kind: 'tube', diameter: 90, height: 150 })).toEqual({
      kind: 'tube',
      radius: 0.45,
      height: 1.5,
    });
  });

  it('crops a round tin lid from the cover only when there is no flat label', () => {
    const lidCrop = { centerX: 0.5, centerY: 0.32, radius: 0.3 };
    const cropped = layout({ kind: 'round-tin', diameter: 130, height: 45, lidCrop });
    const labelled = layout({
      kind: 'round-tin',
      diameter: 130,
      height: 45,
      lidCrop,
      label: '/l.webp',
    });

    expect(cropped).toEqual({
      kind: 'round-tin',
      radius: 0.65,
      height: 0.45,
      lid: lidTextureTransform(lidCrop),
    });
    expect(labelled).toMatchObject({ lid: lidTextureTransform() });
  });

  it('rejects a cylinder with a non-positive dimension', () => {
    expect(() => layout({ kind: 'tube', diameter: 0, height: 150 })).toThrow(RangeError);
    expect(() => layout({ kind: 'round-tin', diameter: 130, height: Number.NaN })).toThrow(
      RangeError,
    );
  });

  it('puffs a foil bag in proportion to its shorter side', () => {
    const result = layout({ kind: 'foil-bag' });
    expect(result).toMatchObject({ kind: 'foil-bag', width: 1.02, height: 1.43 });
    if (result.kind !== 'foil-bag') throw new Error('Expected a foil bag layout');
    expect(result.puff).toBeCloseTo(1.02 * 0.18);
  });

  it('takes a pouch height from its silhouette aspect', () => {
    const points: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ];
    const result = layoutPackage({
      shape: { kind: 'pouch', cutout: '/fish.webp', outline: { aspect: 2, points } },
      size: { width: 145, height: 215, depth: 49 },
      coverAspect: 1.8,
    });
    if (result.kind !== 'pouch') throw new Error('Expected a pouch layout');

    expect(result.width).toBeCloseTo(2.15);
    expect(result.height).toBeCloseTo(1.075);
    expect(result.puff).toBeCloseTo(1.075 * 0.22);
    expect(result.points).toBe(points);
  });

  it('rejects a pouch with a non-positive aspect', () => {
    expect(() =>
      layout({ kind: 'pouch', cutout: '/fish.webp', outline: { aspect: 0, points: [] } }),
    ).toThrow(RangeError);
  });
});

describe('lidTextureTransform', () => {
  it('uses the whole image, flipped vertically, by default', () => {
    expect(lidTextureTransform()).toEqual({ repeatX: 1, repeatY: -1, offsetX: 0, offsetY: 0 });
  });

  it('zooms onto an off-centre lid', () => {
    const transform = lidTextureTransform({ centerX: 0.5, centerY: 0.32, radius: 0.3 });
    expect(transform.repeatX).toBeCloseTo(0.6);
    expect(transform.repeatY).toBeCloseTo(-0.6);
    expect(transform.offsetX).toBeCloseTo(0);
    expect(transform.offsetY).toBeCloseTo(0.18);
  });
});

describe('packageHalfHeight', () => {
  it('is half the box height for box-like shapes', () => {
    expect(packageHalfHeight(layout({ kind: 'box' }))).toBeCloseTo(0.715);
    expect(packageHalfHeight(layout({ kind: 'rect-tin' }))).toBeCloseTo(0.715);
  });

  it('is the radius for a round tin lying on its back', () => {
    expect(packageHalfHeight(layout({ kind: 'round-tin', diameter: 130, height: 45 }))).toBeCloseTo(
      0.65,
    );
  });

  it('is half the length for an upright tube', () => {
    expect(packageHalfHeight(layout({ kind: 'tube', diameter: 90, height: 150 }))).toBeCloseTo(
      0.75,
    );
  });

  it('is half the height for a bag', () => {
    expect(packageHalfHeight(layout({ kind: 'foil-bag' }))).toBeCloseTo(0.715);
  });
});

describe('artworkUrls', () => {
  it('loads every cover for a plain box', () => {
    expect(artworkUrls(game)).toEqual(game.covers);
  });

  it('adds the hang tab strip to a box', () => {
    const tabbed = {
      ...game,
      shape: { kind: 'box', hangTab: { url: '/tab.webp', heightFraction: 0.2 } },
    } satisfies GameBoxInput;
    expect(artworkUrls(tabbed)).toEqual({ ...game.covers, hangTab: '/tab.webp' });
  });

  it('loads every cover for a rectangular tin', () => {
    expect(artworkUrls({ ...game, shape: { kind: 'rect-tin' } })).toEqual(game.covers);
  });

  it('prefers a cylinder label over the front cover', () => {
    expect(artworkUrls({ ...game, shape: { kind: 'tube', diameter: 90, height: 150 } })).toEqual({
      front: '/g/cover.webp',
    });
    expect(
      artworkUrls({
        ...game,
        shape: { kind: 'round-tin', diameter: 130, height: 45, label: '/g/lid.webp' },
      }),
    ).toEqual({ front: '/g/lid.webp' });
  });

  it('prints the front cover on a foil bag and the cutout on a pouch', () => {
    expect(artworkUrls({ ...game, shape: { kind: 'foil-bag' } })).toEqual({
      front: '/g/cover.webp',
    });
    expect(
      artworkUrls({
        ...game,
        shape: { kind: 'pouch', cutout: '/g/cutout.webp', outline: { aspect: 2, points: [] } },
      }),
    ).toEqual({ front: '/g/cutout.webp' });
  });

  it('does not change the game covers it was given', () => {
    const tabbed: GameBoxInput = {
      ...game,
      shape: { kind: 'box', hangTab: { url: '/tab.webp', heightFraction: 0.2 } },
    };
    artworkUrls(tabbed);
    expect(game.covers).toEqual({ front: '/g/cover.webp', back: '/g/back.webp' });
  });
});
