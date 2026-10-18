import type { BggClient } from '@meeplewall/boardgamegeek';
import {
  enqueueImageJob,
  finishCollectionSync,
  imageKind,
  listGames,
  listImageAssets,
  recordRefresh,
  upsertCollection,
  upsertGame,
  type BggGame,
  type ClaimedCollectionSync,
  type CollectionItemInput,
  type CollectionSyncOutcome,
  type DatabaseExecutor,
} from '@meeplewall/db';

import type { CollectedGame, CollectionProvider } from './collection-provider.ts';
import { GAME_MAX_AGE_SECONDS, isOlderThan } from './freshness.ts';
import { toGameInput } from './game-input.ts';

/** How a run ended. `lost` means the lease ran out and another worker owns the sync now. */
export type SyncRunOutcome = CollectionSyncOutcome | { status: 'lost' };

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
   * Runs a sync `workerId` has claimed to the end and records how it went. Never
   * throws for a BGG or storage failure: that becomes the sync's `failed`
   * outcome. Records nothing when the lease was lost, since the new holder will.
   */
  async runSync({
    claimed: { sync, username },
    workerId,
  }: {
    claimed: ClaimedCollectionSync;
    workerId: string;
  }): Promise<SyncRunOutcome> {
    const startedAt = performance.now();
    const outcome = await this.#syncCollection({ username }).then(
      (): CollectionSyncOutcome => ({ status: 'succeeded' }),
      (error: unknown): CollectionSyncOutcome => ({
        status: 'failed',
        error: describeError(error),
      }),
    );

    const finished = await finishCollectionSync(this.#database, {
      syncId: sync.id,
      workerId,
      outcome,
    });
    if (finished === undefined) {
      return { status: 'lost' };
    }
    await recordRefresh(this.#database, {
      entry: {
        userId: sync.userId,
        source: sync.source,
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
      for (const kind of imageKind.enumValues) {
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

    return known.map(({ entry: { bggId, ...flags } }, sortIndex) => ({
      bggGameId: bggId,
      ...flags,
      sortIndex,
    }));
  }
}
