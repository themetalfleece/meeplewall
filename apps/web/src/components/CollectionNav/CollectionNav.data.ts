import { formatRating } from '@/lib/format';
import type { CollectionGame } from '@/lib/collections';

/** The user's own flags for a game, as short badges. */
export function collectionBadges(
  entry: Pick<CollectionGame, 'owned' | 'wantToPlay' | 'userRating'>,
): string[] {
  const badges: string[] = [];
  if (entry.owned) {
    badges.push('Owned');
  }
  if (entry.wantToPlay) {
    badges.push('Want to play');
  }
  if (entry.userRating !== null) {
    badges.push(`Rated ${formatRating(entry.userRating)}`);
  }

  return badges;
}
