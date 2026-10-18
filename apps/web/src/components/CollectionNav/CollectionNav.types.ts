import type { CollectionNeighbour, CollectionShelf } from '@meeplewall/db';

import type { RouteSearchParams } from '@/lib/route-params';

export interface CollectionNavProps extends RouteSearchParams {
  /** The still-encoded `[uId]` and `[gId]` segments. */
  params: Promise<{ uId: string; gId: string }>;
}

export interface BackLinkProps {
  /** The collection owner's name as the link reads it. */
  owner: string;
  href: string;
}

export interface NeighbourLinkProps {
  username: string;
  shelf: CollectionShelf;
  neighbour: CollectionNeighbour;
  direction: 'previous' | 'next';
}
