import type { BggClient } from '@meeplewall/boardgamegeek';
import {
  enqueueImageJob,
  finishCollectionSync,
  getLatestCollectionSync,
  listGames,
  listImageAssets,
  recordRefresh,
  startCollectionSync,
  upsertCollection,
  upsertGame,
  type BggGame,
  type CollectionItemInput,
  type CollectionSync,
  type CollectionSyncOutcome,
  type DatabaseExecutor,
  type ImageKind,
  type RefreshSource,
} from '@meeplewall/db';

import type { CollectedGame, CollectionProvider } from './collection-provider.ts';
import {
  GAME_MAX_AGE_SECONDS,
  SYNC_ABANDONED_AFTER_SECONDS,
  isOlderThan,
  secondsUntilNextSync,
} from './freshness.ts';
import { toGameInput } from './game-input.ts';

const IMAGE_KINDS: readonly ImageKind[] = ['cover', 'thumb'];

/** What asking for a sync did. Only `started` hands the caller a sync to run. */
export type SyncRequest =
  | { kind: 'started'; sync: CollectionSync }
  | { kind: 'joined'; sync: CollectionSync }
  | { kind: 'throttled'; sync: CollectionSync; retryAfterSeconds: number };

export interface CollectionSyncServiceOptions {
  database: DatabaseExecutor;
  bgg: BggClient;
  provider: CollectionProvider;
  /** The current time. Tests pass a fixed clock. */
  now?: () => Date;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Keeps stored collections in step with BGG. A sync fetches the user's
 * collection, stores any game that is new or stale, replaces the stored
 * collection, and queues an image job for every image not yet processed.
 */
export class CollectionSyncService {
  readonly #database: DatabaseExecutor;
  readonly #bgg: BggClient;
  readonly #provider: CollectionProvider;
  readonly #now: () => Date;

  constructor({ database, bgg, provider, now }: CollectionSyncServiceOptions) {
    this.#database = database;
    this.#bgg = bgg;
    this.#provider = provider;
    this.#now = now ?? (() => new Date());
  }

  /**
   * Starts a sync, joins the one already running, or declines when the user's
   * latest sync started under a minute ago. Running the started sync is the
   * caller's job, through `runSync`, so the caller decides where it runs.
   */
  async requestSync({ username }: { username: string }): Promise<SyncRequest> {
    const latest = await getLatestCollectionSync(this.#database, { username });
    if (latest !== undefined && latest.status !== 'running') {
      const retryAfterSeconds = secondsUntilNextSync({
        startedAt: latest.startedAt,
        now: this.#now(),
      });
      if (retryAfterSeconds > 0) {
        return { kind: 'throttled', sync: latest, retryAfterSeconds };
      }
    }

    const { sync, started } = await startCollectionSync(this.#database, {
      username,
      staleAfterSeconds: SYNC_ABANDONED_AFTER_SECONDS,
    });

    return started ? { kind: 'started', sync } : { kind: 'joined', sync };
  }

  /**
   * Runs a started sync to the end and records how it went. Never throws for a
   * BGG or storage failure: that becomes the sync's `failed` outcome.
   */
  async runSync({
    sync,
    username,
    source,
  }: {
    sync: CollectionSync;
    username: string;
    source: RefreshSource;
  }): Promise<CollectionSyncOutcome> {
    const startedAt = performance.now();
    const outcome = await this.#syncCollection({ username }).then(
      (): CollectionSyncOutcome => ({ status: 'succeeded' }),
      (error: unknown): CollectionSyncOutcome => ({
        status: 'failed',
        error: describeError(error),
      }),
    );

    await finishCollectionSync(this.#database, { syncId: sync.id, outcome });
    await recordRefresh(this.#database, {
      entry: {
        userId: sync.userId,
        source,
        status: outcome.status,
        durationMs: Math.round(performance.now() - startedAt),
      },
    });

    return outcome;
  }

  async #syncCollection({ username }: { username: string }): Promise<void> {
    const collected = await this.#provider.fetchCollection({ username });
    if (collected === null) {
      throw new Error(`BGG has no user named "${username}"`);
    }

    const games = await this.#storeGames({ bggIds: collected.map((entry) => entry.bggId) });
    const gamesById = new Map(games.map((game) => [game.id, game]));

    await upsertCollection(this.#database, {
      username,
      source: this.#provider.transport,
      fetchedAt: this.#now(),
      items: CollectionSyncService.#toItems({ collected, gamesById }),
    });
    await this.#queueMissingImages({ games });
  }

  /** Fetches every game that is missing or stale, and returns all that BGG knows. */
  async #storeGames({ bggIds }: { bggIds: number[] }): Promise<BggGame[]> {
    const uniqueIds = [...new Set(bggIds)];
    const stored = await listGames(this.#database, { bggIds: uniqueIds });
    const now = this.#now();
    const fresh = stored.filter(
      (game) =>
        !isOlderThan({ timestamp: game.updatedAt, now, maxAgeSeconds: GAME_MAX_AGE_SECONDS }),
    );
    const freshIds = new Set(fresh.map((game) => game.id));

    const games = [...fresh];
    // One at a time: the BGG client throttles every request anyway.
    for (const bggId of uniqueIds.filter((id) => !freshIds.has(id))) {
      const game = await this.#fetchGame({ bggId });
      if (game !== undefined) {
        games.push(game);
      }
    }

    return games;
  }

  /** Fetches and stores one game, or returns undefined when BGG has no game with that id. */
  async #fetchGame({ bggId }: { bggId: number }): Promise<BggGame | undefined> {
    const game = await this.#bgg.fetchGame({ bggId });
    if (game === null) {
      return undefined;
    }
    const versions = await this.#bgg.fetchGameVersions({ bggId });

    return upsertGame(this.#database, { game: toGameInput({ game, versions }) });
  }

  /** Queues a job for each image a game has a source for but no processed asset of. */
  async #queueMissingImages({ games }: { games: BggGame[] }): Promise<void> {
    const withSource = games.filter((game) => game.imageUrlRaw !== null);
    const assets = await listImageAssets(this.#database, {
      bggGameIds: withSource.map((game) => game.id),
    });
    const processed = new Set(assets.map((asset) => `${asset.bggGameId}:${asset.kind}`));

    for (const game of withSource) {
      for (const kind of IMAGE_KINDS) {
        if (!processed.has(`${game.id}:${kind}`)) {
          await enqueueImageJob(this.#database, { bggGameId: game.id, kind });
        }
      }
    }
  }

  /**
   * The stored items, sorted by game name so the grid and its previous and next
   * links follow one order. Games BGG does not know are dropped.
   */
  static #toItems({
    collected,
    gamesById,
  }: {
    collected: CollectedGame[];
    gamesById: Map<number, BggGame>;
  }): CollectionItemInput[] {
    const known = collected.flatMap((entry) => {
      const game = gamesById.get(entry.bggId);
      return game === undefined ? [] : [{ entry, name: game.name }];
    });
    known.sort((first, second) => first.name.localeCompare(second.name, 'en'));

    return known.map(({ entry }, sortIndex) => ({
      bggGameId: entry.bggId,
      owned: entry.owned,
      wantToPlay: entry.wantToPlay,
      userRating: entry.userRating,
      sortIndex,
    }));
  }
}
