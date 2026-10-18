import type { CollectionShelf } from '@meeplewall/db';

/** The shelf the collection page shows without a `shelf` query. */
export const MAIN_SHELF: CollectionShelf = 'owned';

interface ShelfDetails {
  /** The `shelf` query value. */
  slug: string;
  label: string;
}

const SHELF_DETAILS: Record<CollectionShelf, ShelfDetails> = {
  owned: { slug: 'owned', label: 'Owned' },
  preordered: { slug: 'preordered', label: 'Pre-ordered' },
  wishlist: { slug: 'wishlist', label: 'Wishlist' },
  wantToBuy: { slug: 'want-to-buy', label: 'Want to buy' },
  wantToPlay: { slug: 'want-to-play', label: 'Want to play' },
  wantInTrade: { slug: 'want-in-trade', label: 'Want in trade' },
  forTrade: { slug: 'for-trade', label: 'For trade' },
  previouslyOwned: { slug: 'previously-owned', label: 'Previously owned' },
};

function isShelf(value: string): value is CollectionShelf {
  return Object.hasOwn(SHELF_DETAILS, value);
}

export function shelfLabel(shelf: CollectionShelf): string {
  return SHELF_DETAILS[shelf].label;
}

/** The query string that opens `shelf`, empty for the main wall so its URL stays canonical. */
export function shelfQuery(shelf: CollectionShelf): string {
  return shelf === MAIN_SHELF ? '' : `?shelf=${SHELF_DETAILS[shelf].slug}`;
}

/** The shelf a `shelf` query names, or the main wall when it is missing or names none. */
export function parseShelf(value: string | string[] | undefined): CollectionShelf {
  const slug = Array.isArray(value) ? value[0] : value;
  const shelf = Object.keys(SHELF_DETAILS)
    .filter(isShelf)
    .find((candidate) => SHELF_DETAILS[candidate].slug === slug);

  return shelf ?? MAIN_SHELF;
}
