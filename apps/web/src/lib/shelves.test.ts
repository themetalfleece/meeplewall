import { describe, expect, it } from 'vitest';

import { parseShelf, shelfLabel, shelfQuery } from './shelves';

describe('parseShelf', () => {
  it.each([
    ['wishlist', 'wishlist'],
    ['want-to-play', 'wantToPlay'],
    ['previously-owned', 'previouslyOwned'],
  ])('reads %s as %s', (slug, shelf) => {
    expect(parseShelf(slug)).toBe(shelf);
  });

  it('falls back to the main wall when the query is missing or unknown', () => {
    expect(parseShelf(undefined)).toBe('owned');
    expect(parseShelf('wantToPlay')).toBe('owned');
    expect(parseShelf('toString')).toBe('owned');
  });

  it('reads the first of a repeated query', () => {
    expect(parseShelf(['wishlist', 'for-trade'])).toBe('wishlist');
  });
});

describe('shelfQuery', () => {
  it('is empty for the main wall', () => {
    expect(shelfQuery('owned')).toBe('');
  });

  it('round-trips through parseShelf', () => {
    expect(shelfQuery('wantToBuy')).toBe('?shelf=want-to-buy');
    expect(parseShelf('want-to-buy')).toBe('wantToBuy');
  });
});

describe('shelfLabel', () => {
  it('names a shelf for people', () => {
    expect(shelfLabel('preordered')).toBe('Pre-ordered');
  });
});
