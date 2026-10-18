import { describe, expect, it } from 'vitest';

import { describeGameCount } from './CollectionSection.data';

describe('describeGameCount', () => {
  it.each([
    [0, '0 games'],
    [1, '1 game'],
    [42, '42 games'],
  ])('describes %i as %s', (count, text) => {
    expect(describeGameCount(count)).toBe(text);
  });
});
