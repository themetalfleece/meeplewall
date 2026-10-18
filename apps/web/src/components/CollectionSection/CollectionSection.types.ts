import type { CollectionShelf } from '@meeplewall/db';

import type { ShelfTab } from '@/lib/collections';
import type { RouteSearchParams } from '@/lib/route-params';

export interface CollectionSectionProps extends RouteSearchParams {
  /** The still-encoded `[uId]` segment. */
  params: Promise<{ uId: string }>;
}

export interface ShelfTabsProps {
  username: string;
  shelves: ShelfTab[];
  current: CollectionShelf;
}
