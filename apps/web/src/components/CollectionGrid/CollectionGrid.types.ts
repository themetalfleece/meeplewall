import type { CollectionCard } from '@/lib/collections';

export interface CollectionGridProps {
  username: string;
  cards: CollectionCard[];
}

export interface GameCardProps {
  username: string;
  card: CollectionCard;
}
