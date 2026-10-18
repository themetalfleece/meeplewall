import { ExtrudeGeometry, Path, PlaneGeometry, Shape } from 'three';
import type { HangHole } from './types.js';

// Package geometries. Every builder takes world units and centres the result on the origin.
// The pouch's mesher is in pouchGeometry.ts.

/** A rounded-rectangle profile: flat sides, quadratic corners. */
export function roundedRectShape({
  width,
  height,
  radius,
}: {
  width: number;
  height: number;
  radius: number;
}): Shape {
  const left = -width / 2;
  const bottom = -height / 2;
  const right = left + width;
  const top = bottom + height;

  const shape = new Shape();
  shape.moveTo(left + radius, bottom);
  shape.lineTo(right - radius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top);
  shape.quadraticCurveTo(left, top, left, top - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  return shape;
}

/** A metal tin: a rounded-corner profile extruded through its depth, with crisp flat faces. */
export function tinGeometry({
  width,
  height,
  depth,
  cornerRadius,
}: {
  width: number;
  height: number;
  depth: number;
  /** Fraction of the shorter front edge. */
  cornerRadius: number;
}): ExtrudeGeometry {
  const profile = roundedRectShape({
    width,
    height,
    radius: Math.min(width, height) * cornerRadius,
  });
  const geometry = extrudeCentred({ shape: profile, depth });
  geometry.computeVertexNormals();
  return geometry;
}

/** Extrudes a flat profile through `depth` with square edges, centred on z = 0. */
function extrudeCentred({ shape, depth }: { shape: Shape; depth: number }): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 8,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

const KEYHOLE_RAYS = 120;

/**
 * A keyhole outline: the union of a rounded slot and a circle, traced as one
 * path by marching rays out from the slot centre and keeping the farthest point
 * still inside either shape.
 */
function keyholePath({
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  slotRadius,
  circleY,
  circleRadius,
}: {
  centerX: number;
  centerY: number;
  halfWidth: number;
  halfHeight: number;
  slotRadius: number;
  circleY: number;
  circleRadius: number;
}): Path {
  const insideSlot = (pointX: number, pointY: number): boolean => {
    const excessX = Math.abs(pointX - centerX) - (halfWidth - slotRadius);
    const excessY = Math.abs(pointY - centerY) - (halfHeight - slotRadius);
    const outside = Math.hypot(Math.max(excessX, 0), Math.max(excessY, 0));
    return outside + Math.min(Math.max(excessX, excessY), 0) - slotRadius <= 0;
  };
  const inside = (pointX: number, pointY: number): boolean =>
    insideSlot(pointX, pointY) || Math.hypot(pointX - centerX, pointY - circleY) <= circleRadius;

  const reach = Math.max(halfWidth, halfHeight) + 2 * circleRadius + Math.abs(circleY - centerY);
  const step = Math.max(0.0005, Math.min(halfHeight, circleRadius) / 8);

  const path = new Path();
  for (let ray = 0; ray < KEYHOLE_RAYS; ray++) {
    const angle = (ray / KEYHOLE_RAYS) * Math.PI * 2;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    let farthest = 0;
    for (let distance = 0; distance <= reach; distance += step) {
      if (inside(centerX + directionX * distance, centerY + directionY * distance)) {
        farthest = distance;
      }
    }

    const pointX = centerX + directionX * farthest;
    const pointY = centerY + directionY * farthest;
    if (ray === 0) path.moveTo(pointX, pointY);
    else path.lineTo(pointX, pointY);
  }
  path.closePath();
  return path;
}

/**
 * A hang tab: a thin slab whose base sits on y = 0, with rounded free corners
 * and an optional keyhole. Its front and back faces sample artwork that spans
 * `artWidth`, so a tab narrower than the art shows only the art's central band.
 */
export function hangTabGeometry({
  width,
  artWidth,
  height,
  thickness,
  cornerRadius,
  hole,
}: {
  width: number;
  artWidth: number;
  height: number;
  thickness: number;
  /** Fraction of the tab's shorter side. */
  cornerRadius: number;
  hole: HangHole | null;
}): ExtrudeGeometry {
  const radius = Math.min(width, height) * cornerRadius;
  const left = -width / 2;
  const right = width / 2;

  const shape = new Shape();
  shape.moveTo(left, 0);
  shape.lineTo(right, 0);
  shape.lineTo(right, height - radius);
  shape.quadraticCurveTo(right, height, right - radius, height);
  shape.lineTo(left + radius, height);
  shape.quadraticCurveTo(left, height, left, height - radius);
  shape.lineTo(left, 0);
  if (hole) shape.holes.push(hangHolePath({ hole, artWidth, height }));

  const geometry = extrudeCentred({ shape, depth: thickness });

  // Map the caps onto the art: across the full art width, and bottom to top of the tab.
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index++) {
    uvs.setXY(index, positions.getX(index) / artWidth + 0.5, positions.getY(index) / height);
  }
  uvs.needsUpdate = true;
  return geometry;
}

function hangHolePath({
  hole,
  artWidth,
  height,
}: {
  hole: HangHole;
  artWidth: number;
  height: number;
}): Path {
  const toX = (fraction: number): number => (fraction - 0.5) * artWidth;
  const toY = (fraction: number): number => (1 - fraction) * height;
  const left = toX(hole.left);
  const right = toX(hole.right);
  const top = toY(hole.top);
  const bottom = toY(hole.bottom);
  const halfWidth = Math.abs(right - left) / 2;
  const halfHeight = Math.abs(top - bottom) / 2;

  return keyholePath({
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    halfWidth,
    halfHeight,
    slotRadius: Math.min(halfWidth, halfHeight) * (hole.slotRounding ?? 1),
    circleY: Math.max(top, bottom),
    circleRadius: hole.circleRadius * height,
  });
}

/**
 * One side of a puffed pillow: a plane bulged towards +z, flat at its edges.
 * With `creases` it gains crimped side seals and soft wrinkles, like a snack bag.
 * Mirror it in z for the back.
 */
export function pillowGeometry({
  width,
  height,
  puff,
  creases,
}: {
  width: number;
  height: number;
  puff: number;
  creases: boolean;
}): PlaneGeometry {
  const segments = creases ? 48 : 32;
  const geometry = new PlaneGeometry(width, height, segments, segments);
  const positions = geometry.getAttribute('position');

  for (let index = 0; index < positions.count; index++) {
    const normalX = positions.getX(index) / (width / 2);
    const normalY = positions.getY(index) / (height / 2);
    let bulge =
      puff *
      Math.max(0, Math.cos((normalX * Math.PI) / 2)) *
      Math.max(0, Math.cos((normalY * Math.PI) / 2));
    if (creases) bulge += puff * creaseOffset({ normalX, normalY });
    positions.setZ(index, bulge);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Crimped side seals plus off-centre wrinkles, as a fraction of the puff. */
function creaseOffset({ normalX, normalY }: { normalX: number; normalY: number }): number {
  // Left and right seals run out of phase, so the bag is not mirror-symmetric.
  const sealWeight = Math.max(0, Math.abs(normalX) - 0.5) / 0.5;
  const sealPhase = normalX < 0 ? 0 : 1.3;
  const seal = 0.3 * sealWeight * Math.sin(normalY * Math.PI * 6.5 + sealPhase);
  // Incommensurate sines keep the wrinkles from looking regular.
  const wrinkles =
    0.13 * Math.sin(normalX * 7.7 + normalY * 5.3 + 1.9) * Math.cos(normalY * 4.1 - normalX * 2.2) +
    0.07 * Math.sin(normalX * 13.1 - normalY * 3.7);
  return seal + wrinkles;
}
