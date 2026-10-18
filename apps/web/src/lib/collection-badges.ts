import {
  COLLECTION_SHELVES,
  isOnShelf,
  type CollectionItem,
  type CollectionShelf,
} from '@meeplewall/db';

import { formatRating } from './format';
import { shelfLabel } from './shelves';

/** One of the user's own flags for a game, or their rating, as a short label. */
export interface CollectionBadge {
  kind: CollectionShelf | 'rating';
  label: string;
}

/** BGG's names for wishlist priorities 1 to 5. */
const WISHLIST_PRIORITY_LABELS = new Map([
  [1, 'Must have'],
  [2, 'Love to have'],
  [3, 'Like to have'],
  [4, 'Thinking about it'],
  [5, "Don't buy this"],
]);

export type BadgeSource = Pick<CollectionItem, CollectionShelf | 'wishlistPriority' | 'userRating'>;

function wishlistLabel(priority: number | null): string {
  const priorityLabel = priority === null ? undefined : WISHLIST_PRIORITY_LABELS.get(priority);

  return priorityLabel === undefined ? shelfLabel('wishlist') : `Wishlist: ${priorityLabel}`;
}

function shelfBadgeLabel({ item, shelf }: { item: BadgeSource; shelf: CollectionShelf }): string {
  if (shelf === 'wishlist') {
    return wishlistLabel(item.wishlistPriority);
  }

  return shelfLabel(shelf);
}

/** The user's own flags for a game in shelf order, then their rating. */
export function collectionBadges(item: BadgeSource): CollectionBadge[] {
  const badges: CollectionBadge[] = COLLECTION_SHELVES.filter((shelf) =>
    isOnShelf({ item, shelf }),
  ).map((shelf) => ({ kind: shelf, label: shelfBadgeLabel({ item, shelf }) }));
  if (item.userRating !== null) {
    badges.push({ kind: 'rating', label: `Rated ${formatRating(item.userRating)}` });
  }

  return badges;
}
