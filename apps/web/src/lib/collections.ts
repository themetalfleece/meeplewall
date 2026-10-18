import { requestCollectionSync } from '@meeplewall/collection-sync';
import {
  getCollectionByUsername,
  getCollectionEntry,
  getLatestCollectionSync,
  listImageAssets,
  type CollectionNeighbour,
  type ImageAsset,
} from '@meeplewall/db';

import { storagePublicBaseUrl } from './env';
import { resolveGameImages } from './game-view';
import { getDatabase } from './services';
import { needsSync, toSyncStatus } from './sync';
import type { SyncStatus } from './sync-status';

/** One game on a collection grid. */
export interface CollectionCard {
  bggId: number;
  name: string;
  year: number | null;
  thumbUrl: string | null;
  owned: boolean;
  wantToPlay: boolean;
  userRating: number | null;
}

export interface CollectionPage {
  /** The username as BGG spells it once a sync has stored it, else as typed in the URL. */
  displayName: string;
  /** Null until the first sync stores the collection. */
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

/**
 * Reads a user's stored collection and, when it is missing or a day old, queues a sync for the
 * sync worker. Never waits on BGG: the client polls the sync status instead.
 */
export async function loadCollectionPage({
  username,
}: {
  username: string;
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
    return { displayName: username, cards: null, fetchedAt: null, sync };
  }

  const assets = await listImageAssets(database, {
    bggGameIds: stored.items.map(({ game }) => game.id),
  });
  const assetsByGame = groupByGame(assets);
  const publicBaseUrl = storagePublicBaseUrl();
  const cards = stored.items.map(({ item, game }) => ({
    bggId: game.id,
    name: game.name,
    year: game.year,
    thumbUrl: resolveGameImages({
      game,
      assets: assetsByGame.get(game.id) ?? [],
      publicBaseUrl,
    }).thumbUrl,
    owned: item.owned,
    wantToPlay: item.wantToPlay,
    userRating: item.userRating,
  }));

  return {
    displayName: stored.user.bggUsername,
    cards,
    fetchedAt: stored.collection.fetchedAt.toISOString(),
    sync,
  };
}

/** A game as it sits in one user's collection. */
export interface CollectionGame {
  displayName: string;
  owned: boolean;
  wantToPlay: boolean;
  userRating: number | null;
  /** One-based, for "3 of 40". */
  position: number;
  itemCount: number;
  previous: CollectionNeighbour | null;
  next: CollectionNeighbour | null;
}

/** Reads a game's place in a user's stored collection, or null when it is not in it. */
export async function loadCollectionGame({
  username,
  bggId,
}: {
  username: string;
  bggId: number;
}): Promise<CollectionGame | null> {
  const entry = await getCollectionEntry(getDatabase(), { username, bggGameId: bggId });
  if (entry === undefined) {
    return null;
  }

  return {
    displayName: entry.user.bggUsername,
    owned: entry.item.owned,
    wantToPlay: entry.item.wantToPlay,
    userRating: entry.item.userRating,
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

  return {
    displayName: stored.user.bggUsername,
    itemCount: stored.items.length,
    coverUrls: stored.items
      .flatMap(({ game }) => (game.thumbUrlRaw === null ? [] : [game.thumbUrlRaw]))
      .slice(0, SUMMARY_COVER_COUNT),
  };
}
