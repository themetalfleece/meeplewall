import { type BufferGeometry, Box3, type Vector3 } from 'three';
import { expect } from 'vitest';

/** A geometry's axis-aligned bounds. */
export function boundsOf(geometry: BufferGeometry): { min: Vector3; max: Vector3 } {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new Box3();
  return { min: box.min, max: box.max };
}

export function expectVectorClose(actual: Vector3, expected: [number, number, number]): void {
  expect(actual.x).toBeCloseTo(expected[0]);
  expect(actual.y).toBeCloseTo(expected[1]);
  expect(actual.z).toBeCloseTo(expected[2]);
}
