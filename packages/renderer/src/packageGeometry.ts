import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  PlaneGeometry,
  Shape,
  ShapeUtils,
  Vector2,
} from 'three';
import type { HangHole } from './types.js';

// Package geometries. Every builder takes world units and centres the result on the origin.

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
  const geometry = new ExtrudeGeometry(profile, {
    depth,
    bevelEnabled: false,
    curveSegments: 8,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
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

  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -thickness / 2);

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

const POUCH_SUBDIVISIONS = 3;

/**
 * A closed pouch cut to a silhouette. The outline is triangulated and
 * subdivided so the cap has interior vertices to bulge, then a front cap and a
 * mirrored back cap are welded where the bulge reaches zero at the rim, giving
 * one watertight solid. UVs project the cutout straight onto both caps.
 */
export function pouchGeometry({
  points,
  width,
  height,
  puff,
}: {
  /** The silhouette, as fractions of the cutout measured from its top left. */
  points: ReadonlyArray<readonly [number, number]>;
  width: number;
  height: number;
  puff: number;
}): BufferGeometry {
  if (points.length < 3) throw new RangeError('A pouch outline needs at least three points');

  const contour = points.map(([fractionX, fractionY]) => {
    return new Vector2((fractionX - 0.5) * width, (0.5 - fractionY) * height);
  });
  // Counter-clockwise, so the front cap faces +z.
  if (ShapeUtils.area(contour) < 0) contour.reverse();

  const rimDistance = Math.min(width, height) * 0.22;
  const bulge = (point: Vector2): number => {
    const toEdge = distanceToOutline({ point, outline: contour });
    return puff * Math.sin((Math.min(1, toEdge / rimDistance) * Math.PI) / 2);
  };

  const { vertices, triangles } = subdivide({
    vertices: contour.map((point) => point.clone()),
    triangles: ShapeUtils.triangulateShape(contour, []),
  });

  const welder = new VertexWelder({ width, height, tolerance: Math.min(width, height) * 1e-3 });
  const indices: number[] = [];
  for (const triangle of triangles) {
    const corners = triangle.map((index) => vertexAt({ vertices, index }));
    const front = corners.map((point) => welder.add({ point, z: bulge(point) }));
    const back = corners.map((point) => welder.add({ point, z: -bulge(point) }));
    // A triangle lying wholly on the rim, at a sharp tip, is flat: its two
    // copies coincide and would leave a zero-thickness fin.
    if (front.every((index, corner) => index === back[corner])) continue;

    indices.push(...front);
    // Reversed winding, so the back cap faces -z.
    indices.push(...back.reverse());
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(welder.positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(welder.uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function vertexAt({ vertices, index }: { vertices: Vector2[]; index: number }): Vector2 {
  const vertex = vertices[index];
  if (!vertex) throw new Error(`Triangle refers to missing vertex ${index}`);

  return vertex;
}

/** Splits every triangle into four, sharing each edge's midpoint between its two triangles. */
function subdivide({ vertices, triangles }: { vertices: Vector2[]; triangles: number[][] }): {
  vertices: Vector2[];
  triangles: number[][];
} {
  let current = triangles;
  for (let pass = 0; pass < POUCH_SUBDIVISIONS; pass++) {
    const midpoints = new Map<string, number>();
    const midpoint = (first: number, second: number): number => {
      const key = first < second ? `${first}:${second}` : `${second}:${first}`;
      const existing = midpoints.get(key);
      if (existing !== undefined) return existing;

      const index = vertices.length;
      vertices.push(
        vertexAt({ vertices, index: first })
          .clone()
          .add(vertexAt({ vertices, index: second }))
          .multiplyScalar(0.5),
      );
      midpoints.set(key, index);
      return index;
    };

    const next: number[][] = [];
    for (const [first = 0, second = 0, third = 0] of current) {
      const firstSecond = midpoint(first, second);
      const secondThird = midpoint(second, third);
      const thirdFirst = midpoint(third, first);
      next.push(
        [first, firstSecond, thirdFirst],
        [firstSecond, second, secondThird],
        [thirdFirst, secondThird, third],
        [firstSecond, secondThird, thirdFirst],
      );
    }
    current = next;
  }
  return { vertices, triangles: current };
}

/** Collects vertices, merging any that land on the same rounded position. */
class VertexWelder {
  readonly positions: number[] = [];
  readonly uvs: number[] = [];
  readonly #indexByKey = new Map<string, number>();
  readonly #width: number;
  readonly #height: number;
  readonly #tolerance: number;

  constructor({ width, height, tolerance }: { width: number; height: number; tolerance: number }) {
    this.#width = width;
    this.#height = height;
    this.#tolerance = tolerance;
  }

  add({ point, z }: { point: Vector2; z: number }): number {
    const key = [point.x, point.y, z].map((value) => Math.round(value / this.#tolerance)).join('_');
    const existing = this.#indexByKey.get(key);
    if (existing !== undefined) return existing;

    const index = this.positions.length / 3;
    this.positions.push(point.x, point.y, z);
    this.uvs.push(point.x / this.#width + 0.5, point.y / this.#height + 0.5);
    this.#indexByKey.set(key, index);
    return index;
  }
}

function distanceToOutline({ point, outline }: { point: Vector2; outline: Vector2[] }): number {
  let nearest = Infinity;
  outline.forEach((start, index) => {
    const end = outline[(index + 1) % outline.length] ?? start;
    nearest = Math.min(nearest, distanceToSegment({ point, start, end }));
  });
  return nearest;
}

/** Distance from a point to the closest point on a line segment. */
export function distanceToSegment({
  point,
  start,
  end,
}: {
  point: Vector2;
  start: Vector2;
  end: Vector2;
}): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const along =
    lengthSquared > 0
      ? ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared
      : 0;
  const clamped = Math.max(0, Math.min(1, along));
  return Math.hypot(point.x - (start.x + clamped * deltaX), point.y - (start.y + clamped * deltaY));
}
