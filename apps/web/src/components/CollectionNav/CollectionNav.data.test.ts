import { describe, expect, it } from 'vitest';

import { collectionBadges } from './CollectionNav.data';

describe('collectionBadges', () => {
  it('lists every flag the user set', () => {
    expect(collectionBadges({ owned: true, wantToPlay: true, userRating: 8.5 })).toEqual([
      'Owned',
      'Want to play',
      'Rated 8.5',
    ]);
  });

  it('is empty for a game with no flags', () => {
    expect(collectionBadges({ owned: false, wantToPlay: false, userRating: null })).toEqual([]);
  });
});
