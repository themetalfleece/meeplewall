import type { BggCollectionItem } from '@meeplewall/boardgamegeek';
import type { CollectionSource } from '@meeplewall/db';

/** One game in a user's BGG collection, with that user's own status flags and rating. */
export type CollectedGame = BggCollectionItem;

/** Reads a user's whole collection from BGG. One implementation per BGG transport. */
export interface CollectionProvider {
  /** Recorded on the stored collection, so a row says which transport fetched it. */
  readonly transport: CollectionSource;
  /** Every game in the collection, or null when BGG has no user with that name. */
  fetchCollection(options: { username: string }): Promise<CollectedGame[] | null>;
}
