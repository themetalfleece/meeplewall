import type { CollectionNeighbour } from '@meeplewall/db';

export interface CollectionNavProps {
  /** The still-encoded `[uId]` and `[gId]` segments. */
  params: Promise<{ uId: string; gId: string }>;
}

export interface NeighbourLinkProps {
  username: string;
  neighbour: CollectionNeighbour;
  direction: 'previous' | 'next';
}
