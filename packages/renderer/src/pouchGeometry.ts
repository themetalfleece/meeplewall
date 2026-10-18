import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';

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
