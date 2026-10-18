import type { CollectionSource } from '@meeplewall/db';

/** One game in a user's BGG collection, with that user's own status flags and rating. */
export interface CollectedGame {
  bggId: number;
  owned: boolean;
  previouslyOwned: boolean;
  forTrade: boolean;
  wantInTrade: boolean;
  wantToPlay: boolean;
  wantToBuy: boolean;
  wishlist: boolean;
  /** 1 (must have) to 5 (don't buy this), or null when not wishlisted or unknown. */
  wishlistPriority: number | null;
  preordered: boolean;
  /** The user's rating out of 10, or null when they have not rated it. */
  userRating: number | null;
}

/** Reads a user's whole collection from BGG. One implementation per BGG transport. */
export interface CollectionProvider {
  /** Recorded on the stored collection, so a row says which transport fetched it. */
  readonly transport: CollectionSource;
  /** Every game in the collection, or null when BGG has no user with that name. */
  fetchCollection(options: { username: string }): Promise<CollectedGame[] | null>;
}
