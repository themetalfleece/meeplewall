import type { CollectionShelf } from '@meeplewall/db';

import type { CollectionCard } from '@/lib/collections';

export interface CollectionGridProps {
  username: string;
  shelf: CollectionShelf;
  cards: CollectionCard[];
}

export interface GameCardProps {
  username: string;
  shelf: CollectionShelf;
  card: CollectionCard;
}
