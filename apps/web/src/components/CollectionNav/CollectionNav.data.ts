import type { CollectionGame } from '@/lib/collections';
import { MAIN_SHELF, shelfLabel } from '@/lib/shelves';

/** The game's place on its shelf: `3 of 40` on the main wall, `3 of 12 in Wishlist` elsewhere. */
export function describePosition(
  entry: Pick<CollectionGame, 'shelf' | 'position' | 'itemCount'>,
): string {
  const position = `${entry.position} of ${entry.itemCount}`;

  return entry.shelf === MAIN_SHELF ? position : `${position} in ${shelfLabel(entry.shelf)}`;
}
