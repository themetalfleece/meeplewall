import { describe, expect, it } from 'vitest';

import { collectionBadges, type BadgeSource } from './collection-badges';

const NO_STATUS: BadgeSource = {
  owned: false,
  preordered: false,
  wishlist: false,
  wishlistPriority: null,
  wantToBuy: false,
  wantToPlay: false,
  wantInTrade: false,
  forTrade: false,
  previouslyOwned: false,
  userRating: null,
};

describe('collectionBadges', () => {
  it('lists every flag the user set in shelf order, then the rating', () => {
    expect(
      collectionBadges({
        ...NO_STATUS,
        forTrade: true,
        owned: true,
        wantToPlay: true,
        userRating: 8.5,
      }),
    ).toEqual([
      { kind: 'owned', label: 'Owned' },
      { kind: 'wantToPlay', label: 'Want to play' },
      { kind: 'forTrade', label: 'For trade' },
      { kind: 'rating', label: 'Rated 8.5' },
    ]);
  });

  it('names the wishlist priority', () => {
    expect(collectionBadges({ ...NO_STATUS, wishlist: true, wishlistPriority: 4 })).toEqual([
      { kind: 'wishlist', label: 'Wishlist: Thinking about it' },
    ]);
  });

  it('labels a wishlist game with no known priority plainly', () => {
    expect(collectionBadges({ ...NO_STATUS, wishlist: true, wishlistPriority: 9 })).toEqual([
      { kind: 'wishlist', label: 'Wishlist' },
    ]);
  });

  it('is empty for a game with no flags', () => {
    expect(collectionBadges(NO_STATUS)).toEqual([]);
  });
});
