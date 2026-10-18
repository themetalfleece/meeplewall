import { type BufferGeometry, Vector2 } from 'three';
import { describe, expect, it } from 'vitest';
import { boundsOf, expectVectorClose } from './testing/geometryAssertions.js';
import { distanceToSegment, pouchGeometry } from './pouchGeometry.js';

/** Each undirected edge of an indexed mesh, with how many triangles share it. */
function edgeUseCounts(geometry: BufferGeometry): Map<string, number> {
  const index = geometry.getIndex();
  if (!index) throw new Error('Expected an indexed geometry');

  const counts = new Map<string, number>();
  for (let triangle = 0; triangle < index.count; triangle += 3) {
    const corners = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)];
    corners.forEach((corner, position) => {
      const next = corners[(position + 1) % 3] ?? corner;
      const key = corner < next ? `${corner}:${next}` : `${next}:${corner}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  }
  return counts;
}

describe('pouchGeometry', () => {
  const diamond: Array<[number, number]> = [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ];

  it('is watertight: every edge is shared by exactly two triangles', () => {
    const geometry = pouchGeometry({ points: diamond, width: 2, height: 1, puff: 0.2 });
    const counts = [...edgeUseCounts(geometry).values()];

    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((count) => count === 2)).toBe(true);
  });

  it('stays watertight for a clockwise outline', () => {
    const geometry = pouchGeometry({
      points: [...diamond].reverse(),
      width: 2,
      height: 1,
      puff: 0.2,
    });
    expect([...edgeUseCounts(geometry).values()].every((count) => count === 2)).toBe(true);
  });

  it('spans the silhouette and bulges no further than the puff on either side', () => {
    const { min, max } = boundsOf(
      pouchGeometry({ points: diamond, width: 2, height: 1, puff: 0.2 }),
    );
    expectVectorClose(min, [-1, -0.5, min.z]);
    expectVectorClose(max, [1, 0.5, max.z]);
    expect(max.z).toBeGreaterThan(0);
    expect(max.z).toBeLessThanOrEqual(0.2 + 1e-6);
    expect(min.z).toBeCloseTo(-max.z);
  });

  it('projects the cutout straight on, top of the image at the top', () => {
    const geometry = pouchGeometry({ points: diamond, width: 2, height: 1, puff: 0.2 });
    const positions = geometry.getAttribute('position');
    const uvs = geometry.getAttribute('uv');
    for (let index = 0; index < positions.count; index++) {
      expect(uvs.getX(index)).toBeCloseTo(positions.getX(index) / 2 + 0.5);
      expect(uvs.getY(index)).toBeCloseTo(positions.getY(index) + 0.5);
    }
  });

  it('rejects an outline with fewer than three points', () => {
    expect(() =>
      pouchGeometry({
        points: [
          [0, 0],
          [1, 1],
        ],
        width: 1,
        height: 1,
        puff: 0.1,
      }),
    ).toThrow(RangeError);
  });
});

describe('distanceToSegment', () => {
  const start = new Vector2(0, 0);
  const end = new Vector2(2, 0);

  it('measures perpendicular to the segment', () => {
    expect(distanceToSegment({ point: new Vector2(1, 3), start, end })).toBeCloseTo(3);
  });

  it('measures to the nearer end beyond the segment', () => {
    expect(distanceToSegment({ point: new Vector2(5, 4), start, end })).toBeCloseTo(5);
  });

  it('treats a zero-length segment as a point', () => {
    expect(distanceToSegment({ point: new Vector2(3, 4), start, end: start })).toBeCloseTo(5);
  });
});
