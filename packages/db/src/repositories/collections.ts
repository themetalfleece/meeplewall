import { and, asc, eq } from 'drizzle-orm';

import type { DatabaseExecutor } from '../database.ts';
import {
  bggGames,
  bggUsers,
  collectionItems,
  userCollections,
  type BggGame,
  type BggUser,
  type CollectionItem,
  type CollectionSource,
  type NewCollectionItem,
  type UserCollection,
} from '../schema/index.ts';
import { ensureUser, findUser } from './users.ts';

export type CollectionItemInput = Omit<NewCollectionItem, 'collectionId'>;

export interface CollectionWithItems {
  user: BggUser;
  collection: UserCollection;
  /** Ordered by `sortIndex`. */
  items: { item: CollectionItem; game: BggGame }[];
}

/** Reads a user's stored collection with its games, or undefined if it was never synced. */
export async function getCollectionByUsername(
  database: DatabaseExecutor,
  { username }: { username: string },
): Promise<CollectionWithItems | undefined> {
  const user = await findUser(database, { username });
  if (user === undefined) {
    return undefined;
  }

  const [collection] = await database
    .select()
    .from(userCollections)
    .where(eq(userCollections.userId, user.id));
  if (collection === undefined) {
    return undefined;
  }

  const items = await database
    .select({ item: collectionItems, game: bggGames })
    .from(collectionItems)
    .innerJoin(bggGames, eq(collectionItems.bggGameId, bggGames.id))
    .where(eq(collectionItems.collectionId, collection.id))
    .orderBy(asc(collectionItems.sortIndex));

  return { user, collection, items };
}

/** A game's neighbour in a collection's sort order. */
export interface CollectionNeighbour {
  bggGameId: number;
  name: string;
}

export interface CollectionEntry {
  user: BggUser;
  item: CollectionItem;
  game: BggGame;
  /** Zero-based place of the game in the collection's sort order. */
  position: number;
  itemCount: number;
  previous: CollectionNeighbour | null;
  next: CollectionNeighbour | null;
}

/**
 * Reads one game of a user's stored collection with its neighbours in sort
 * order, or undefined when the user, the collection or the game is missing.
 */
export async function getCollectionEntry(
  database: DatabaseExecutor,
  { username, bggGameId }: { username: string; bggGameId: number },
): Promise<CollectionEntry | undefined> {
  const user = await findUser(database, { username });
  if (user === undefined) {
    return undefined;
  }

  const order = await database
    .select({ bggGameId: collectionItems.bggGameId, name: bggGames.name })
    .from(collectionItems)
    .innerJoin(userCollections, eq(collectionItems.collectionId, userCollections.id))
    .innerJoin(bggGames, eq(collectionItems.bggGameId, bggGames.id))
    .where(eq(userCollections.userId, user.id))
    .orderBy(asc(collectionItems.sortIndex));
  const position = order.findIndex((neighbour) => neighbour.bggGameId === bggGameId);
  if (position === -1) {
    return undefined;
  }

  const [row] = await database
    .select({ item: collectionItems, game: bggGames })
    .from(collectionItems)
    .innerJoin(userCollections, eq(collectionItems.collectionId, userCollections.id))
    .innerJoin(bggGames, eq(collectionItems.bggGameId, bggGames.id))
    .where(and(eq(userCollections.userId, user.id), eq(collectionItems.bggGameId, bggGameId)));
  if (row === undefined) {
    return undefined;
  }

  return {
    user,
    item: row.item,
    game: row.game,
    position,
    itemCount: order.length,
    previous: order[position - 1] ?? null,
    next: order[position + 1] ?? null,
  };
}

/** Keeps the first entry for each game. BGG lists a game once per owned copy. */
function uniqueByGame(items: CollectionItemInput[]): CollectionItemInput[] {
  const seenGameIds = new Set<number>();

  return items.filter((item) => {
    if (seenGameIds.has(item.bggGameId)) {
      return false;
    }
    seenGameIds.add(item.bggGameId);
    return true;
  });
}

/**
 * Replaces a user's stored collection with a freshly fetched one, creating the
 * user on first sight. Every game must already be in `bgg_games`.
 */
export async function upsertCollection(
  database: DatabaseExecutor,
  {
    username,
    source,
    fetchedAt,
    items,
  }: {
    username: string;
    source: CollectionSource;
    fetchedAt: Date;
    items: CollectionItemInput[];
  },
): Promise<UserCollection> {
  const uniqueItems = uniqueByGame(items);

  return database.transaction(async (transaction) => {
    const user = await ensureUser(transaction, { username });

    const [collection] = await transaction
      .insert(userCollections)
      .values({ userId: user.id, fetchedAt, source, itemCount: uniqueItems.length })
      .onConflictDoUpdate({
        target: userCollections.userId,
        set: { fetchedAt, source, itemCount: uniqueItems.length },
      })
      .returning();
    if (collection === undefined) {
      throw new Error(`Upserting the collection of "${username}" returned no row`);
    }

    await transaction
      .delete(collectionItems)
      .where(eq(collectionItems.collectionId, collection.id));
    if (uniqueItems.length > 0) {
      await transaction
        .insert(collectionItems)
        .values(uniqueItems.map((item) => ({ ...item, collectionId: collection.id })));
    }

    await transaction
      .update(bggUsers)
      .set({ lastSyncedAt: fetchedAt })
      .where(eq(bggUsers.id, user.id));

    return collection;
  });
}
