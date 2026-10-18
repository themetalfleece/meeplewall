import { describe, expect, it } from 'vitest';

import { COLLECTION_SHELVES, firstShelfOf, isOnShelf, type ShelfFlags } from './shelves.ts';

const NO_FLAGS: ShelfFlags = {
  owned: false,
  preordered: false,
  wishlist: false,
  wantToBuy: false,
  wantToPlay: false,
  wantInTrade: false,
  forTrade: false,
  previouslyOwned: false,
};

describe('COLLECTION_SHELVES', () => {
  it('puts the main wall first', () => {
    expect(COLLECTION_SHELVES[0]).toBe('owned');
  });
});

describe('isOnShelf', () => {
  it('reads the flag the shelf is named after', () => {
    const item = { ...NO_FLAGS, wishlist: true };

    expect(isOnShelf({ item, shelf: 'wishlist' })).toBe(true);
    expect(isOnShelf({ item, shelf: 'owned' })).toBe(false);
  });
});

describe('firstShelfOf', () => {
  it('returns the earliest shelf in order', () => {
    expect(firstShelfOf({ ...NO_FLAGS, previouslyOwned: true, wishlist: true })).toBe('wishlist');
  });

  it('returns null when no flag is set', () => {
    expect(firstShelfOf(NO_FLAGS)).toBeNull();
  });
});
