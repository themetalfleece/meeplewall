import { describe, expect, it } from 'vitest';

import { describePosition } from './CollectionNav.data';

describe('describePosition', () => {
  it('reads as a plain count on the main wall', () => {
    expect(describePosition({ shelf: 'owned', position: 3, itemCount: 40 })).toBe('3 of 40');
  });

  it('names any other shelf', () => {
    expect(describePosition({ shelf: 'wishlist', position: 1, itemCount: 12 })).toBe(
      '1 of 12 in Wishlist',
    );
  });
});
