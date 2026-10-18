import { requestCollectionSync } from '@meeplewall/collection-sync';
import {
  COLLECTION_SHELVES,
  getCollectionByUsername,
  getCollectionEntry,
  getLatestCollectionSync,
  isOnShelf,
  listImageAssets,
  type CollectionItem,
  type CollectionNeighbour,
  type CollectionShelf,
  type ImageAsset,
} from '@meeplewall/db';

import { collectionBadges, type CollectionBadge } from './collection-badges';
import { storagePublicBaseUrl } from './env';
import { resolveGameImages } from './game-view';
import { getDatabase } from './services';
import { needsSync, toSyncStatus } from './sync';
import { MAIN_SHELF, shelfLabel } from './shelves';
import type { SyncStatus } from './sync-status';

/** One game on a collection grid. */
export interface CollectionCard {
  bggId: number;
  name: string;
  year: number | null;
  thumbUrl: string | null;
  badges: CollectionBadge[];
}

/** A shelf the collection page links to, with how many games sit on it. */
export interface ShelfTab {
  shelf: CollectionShelf;
  label: string;
  count: number;
}

export interface CollectionPage {
  /** The username as BGG spells it once a sync has stored it, else as typed in the URL. */
  displayName: string;
  shelf: CollectionShelf;
  /** The main wall, the open shelf and every other shelf with a game on it, in shelf order. */
  shelves: ShelfTab[];
  /** The open shelf's games. Null until the first sync stores the collection. */
  cards: CollectionCard[] | null;
  fetchedAt: string | null;
  sync: SyncStatus;
}

function groupByGame(assets: ImageAsset[]): Map<number, ImageAsset[]> {
  const byGame = new Map<number, ImageAsset[]>();
  for (const asset of assets) {
    const group = byGame.get(asset.bggGameId);
    if (group === undefined) {
      byGame.set(asset.bggGameId, [asset]);
    } else {
      group.push(asset);
    }
  }

  return byGame;
}

function shelfTabs({
  items,
  shelf,
}: {
  items: CollectionItem[];
  shelf: CollectionShelf;
}): ShelfTab[] {
  return COLLECTION_SHELVES.map((candidate) => ({
    shelf: candidate,
    label: shelfLabel(candidate),
    count: items.filter((item) => isOnShelf({ item, shelf: candidate })).length,
  })).filter((tab) => tab.count > 0 || tab.shelf === MAIN_SHELF || tab.shelf === shelf);
}

/**
 * Reads one shelf of a user's stored collection and, when the collection is missing or a day old,
 * queues a sync for the sync worker. Never waits on BGG: the client polls the sync status instead.
 */
export async function loadCollectionPage({
  username,
  shelf,
}: {
  username: string;
  shelf: CollectionShelf;
}): Promise<CollectionPage> {
  const database = getDatabase();
  const [stored, latestSync] = await Promise.all([
    getCollectionByUsername(database, { username }),
    getLatestCollectionSync(database, { username }),
  ]);

  const now = new Date();
  let sync = toSyncStatus({ sync: latestSync, now });
  const fetchedAt = stored?.collection.fetchedAt;
  if (sync.state !== 'running' && needsSync({ fetchedAt, now })) {
    const request = await requestCollectionSync(database, { username, source: 'api' });
    sync = toSyncStatus({ sync: request.sync, now });
  }

  if (stored === undefined) {
    return {
      displayName: username,
      shelf,
      shelves: shelfTabs({ items: [], shelf }),
      cards: null,
      fetchedAt: null,
      sync,
    };
  }

  const shelved = stored.items.filter(({ item }) => isOnShelf({ item, shelf }));
  const assets = await listImageAssets(database, {
    bggGameIds: shelved.map(({ game }) => game.id),
  });
  const assetsByGame = groupByGame(assets);
  const publicBaseUrl = storagePublicBaseUrl();
  const cards = shelved.map(({ item, game }) => ({
    bggId: game.id,
    name: game.name,
    year: game.year,
    thumbUrl: resolveGameImages({
      game,
      assets: assetsByGame.get(game.id) ?? [],
      publicBaseUrl,
    }).thumbUrl,
    badges: collectionBadges(item),
  }));

  return {
    displayName: stored.user.bggUsername,
    shelf,
    shelves: shelfTabs({ items: stored.items.map(({ item }) => item), shelf }),
    cards,
    fetchedAt: stored.collection.fetchedAt.toISOString(),
    sync,
  };
}

/** A game as it sits on one shelf of a user's collection. */
export interface CollectionGame {
  displayName: string;
  /** The shelf the position and neighbours are counted on. */
  shelf: CollectionShelf;
  badges: CollectionBadge[];
  /** One-based, for "3 of 40". */
  position: number;
  itemCount: number;
  previous: CollectionNeighbour | null;
  next: CollectionNeighbour | null;
}

/**
 * Reads a game's place on a shelf of a user's stored collection, or null when it is not in the
 * collection. A game not on `shelf` is placed on the first shelf it sits on.
 */
export async function loadCollectionGame({
  username,
  bggId,
  shelf,
}: {
  username: string;
  bggId: number;
  shelf: CollectionShelf;
}): Promise<CollectionGame | null> {
  const entry = await getCollectionEntry(getDatabase(), { username, bggGameId: bggId, shelf });
  if (entry === undefined) {
    return null;
  }

  return {
    displayName: entry.user.bggUsername,
    shelf: entry.shelf,
    badges: collectionBadges(entry.item),
    position: entry.position + 1,
    itemCount: entry.itemCount,
    previous: entry.previous,
    next: entry.next,
  };
}

/** How many covers a collection's social image shows. */
const SUMMARY_COVER_COUNT = 5;

export interface CollectionSummary {
  displayName: string;
  /** Games on the main wall. */
  itemCount: number;
  /** BGG's own thumbnails, which the social image renderer can read. */
  coverUrls: string[];
}

/** A read-only summary of a stored collection for its social image. Never starts a sync. */
export async function loadCollectionSummary({
  username,
}: {
  username: string;
}): Promise<CollectionSummary | null> {
  const stored = await getCollectionByUsername(getDatabase(), { username });
  if (stored === undefined) {
    return null;
  }

  const shelved = stored.items.filter(({ item }) => isOnShelf({ item, shelf: MAIN_SHELF }));

  return {
    displayName: stored.user.bggUsername,
    itemCount: shelved.length,
    coverUrls: shelved
      .flatMap(({ game }) => (game.thumbUrlRaw === null ? [] : [game.thumbUrlRaw]))
      .slice(0, SUMMARY_COVER_COUNT),
  };
}
