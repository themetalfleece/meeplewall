import type { CollectionItem } from './schema/index.ts';

/**
 * Every shelf, the main wall first. A shelf is a slice of a collection by one BGG status flag,
 * named after that flag's column. `owned` is the main wall; the others sit beside it, so a
 * wishlist never mixes with the games on the shelf.
 */
export const COLLECTION_SHELVES = [
  'owned',
  'preordered',
  'wishlist',
  'wantToBuy',
  'wantToPlay',
  'wantInTrade',
  'forTrade',
  'previouslyOwned',
] as const satisfies readonly (keyof CollectionItem)[];

export type CollectionShelf = (typeof COLLECTION_SHELVES)[number];

/** The flags that place an item on its shelves. */
export type ShelfFlags = Pick<CollectionItem, CollectionShelf>;

/** Whether `item` sits on `shelf`. */
export function isOnShelf({ item, shelf }: { item: ShelfFlags; shelf: CollectionShelf }): boolean {
  return item[shelf];
}

/** The first shelf `item` sits on, or null when it has no status flag set. */
export function firstShelfOf(item: ShelfFlags): CollectionShelf | null {
  return COLLECTION_SHELVES.find((shelf) => isOnShelf({ item, shelf })) ?? null;
}
