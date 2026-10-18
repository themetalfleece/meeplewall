import { ShapeUtils } from 'three';
import { describe, expect, it } from 'vitest';
import { boundsOf, expectVectorClose } from './testing/geometryAssertions.js';
import {
  hangTabGeometry,
  pillowGeometry,
  roundedRectShape,
  tinGeometry,
} from './packageGeometry.js';

describe('roundedRectShape', () => {
  it('spans the requested size, centred on the origin', () => {
    const points = roundedRectShape({ width: 4, height: 2, radius: 0.5 }).getPoints(8);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);

    expect(Math.min(...xs)).toBeCloseTo(-2);
    expect(Math.max(...xs)).toBeCloseTo(2);
    expect(Math.min(...ys)).toBeCloseTo(-1);
    expect(Math.max(...ys)).toBeCloseTo(1);
  });

  it('cuts the corners, so its area is less than the full rectangle', () => {
    const points = roundedRectShape({ width: 4, height: 2, radius: 0.5 }).getPoints(8);
    expect(Math.abs(ShapeUtils.area(points))).toBeLessThan(8);
  });

  it('is a plain rectangle with a zero radius', () => {
    const points = roundedRectShape({ width: 4, height: 2, radius: 0 }).getPoints(8);
    expect(Math.abs(ShapeUtils.area(points))).toBeCloseTo(8);
  });
});

describe('tinGeometry', () => {
  it('fills the box dimensions, centred on the origin', () => {
    const { min, max } = boundsOf(
      tinGeometry({ width: 1.02, height: 1.43, depth: 0.38, cornerRadius: 0.155 }),
    );
    expectVectorClose(min, [-0.51, -0.715, -0.19]);
    expectVectorClose(max, [0.51, 0.715, 0.19]);
  });
});

describe('hangTabGeometry', () => {
  const tab = { width: 0.7, artWidth: 1, height: 0.2, thickness: 0.03, cornerRadius: 0.4 };

  it('stands on y = 0, centred in x and z', () => {
    const { min, max } = boundsOf(hangTabGeometry({ ...tab, hole: null }));
    expectVectorClose(min, [-0.35, 0, -0.015]);
    expectVectorClose(max, [0.35, 0.2, 0.015]);
  });

  it('maps the caps across the full art width, so a narrow tab samples the middle band', () => {
    const uvs = hangTabGeometry({ ...tab, hole: null }).getAttribute('uv');
    const us = Array.from({ length: uvs.count }, (_unused, index) => uvs.getX(index));
    const vs = Array.from({ length: uvs.count }, (_unused, index) => uvs.getY(index));

    expect(Math.min(...us)).toBeCloseTo(0.15);
    expect(Math.max(...us)).toBeCloseTo(0.85);
    expect(Math.min(...vs)).toBeCloseTo(0);
    expect(Math.max(...vs)).toBeCloseTo(1);
  });

  it('punches a hole, which adds the hole walls', () => {
    const plain = hangTabGeometry({ ...tab, hole: null });
    const punched = hangTabGeometry({
      ...tab,
      hole: { left: 0.42, top: 0.34, right: 0.58, bottom: 0.64, circleRadius: 0.13 },
    });
    expect(punched.getAttribute('position').count).toBeGreaterThan(
      plain.getAttribute('position').count,
    );
  });
});

describe('pillowGeometry', () => {
  it('bulges by the puff at the centre and lies flat at the edges', () => {
    const geometry = pillowGeometry({ width: 1.4, height: 2, puff: 0.25, creases: false });
    const positions = geometry.getAttribute('position');

    let centreZ = Number.NaN;
    let edgeZ = 0;
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      if (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) centreZ = positions.getZ(index);
      if (Math.abs(Math.abs(x) - 0.7) < 1e-6)
        edgeZ = Math.max(edgeZ, Math.abs(positions.getZ(index)));
    }

    expect(centreZ).toBeCloseTo(0.25);
    expect(edgeZ).toBeCloseTo(0);
  });

  it('wrinkles the surface when creased', () => {
    const smooth = pillowGeometry({ width: 1.4, height: 2, puff: 0.25, creases: false });
    const creased = pillowGeometry({ width: 1.4, height: 2, puff: 0.25, creases: true });

    expect(creased.getAttribute('position').count).toBeGreaterThan(
      smooth.getAttribute('position').count,
    );
    // The seals ripple the side edges, which stay flat on the smooth pillow.
    const { min } = boundsOf(creased);
    expect(min.z).toBeLessThan(0);
    expect(boundsOf(smooth).min.z).toBeCloseTo(0);
  });
});
