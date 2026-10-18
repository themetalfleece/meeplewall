import { createBggClient, createBggCollectionClient } from '@board-games/boardgamegeek';
import { CollectionSyncService } from '@board-games/collection-sync';
import { createDatabase, type Database } from '@board-games/db';

import { bggApiToken, bggUserAgent, databaseUrl } from './env';
import { logError } from './logger';

/** geekdo has no published limit; two a second is what the BGG skill settled on. */
const GEEKDO_REQUESTS_PER_SECOND = 2;
/** XMLAPI2 asks for a few seconds between requests, and a sync makes only one. */
const XMLAPI_REQUESTS_PER_SECOND = 0.2;

interface Services {
  database?: Database;
  syncService?: CollectionSyncService;
}

declare global {
  // Kept on globalThis so a dev hot reload reuses the pool instead of opening another.
  var boardGamesServices: Services | undefined;
}

function services(): Services {
  globalThis.boardGamesServices ??= {};

  return globalThis.boardGamesServices;
}

function createPool(): Database {
  const database = createDatabase({ connectionString: databaseUrl() });
  database.$client.on('error', (error) => {
    logError({ message: 'Idle Postgres connection failed', error });
  });

  return database;
}

/** The process-wide Postgres pool, opened on first use. */
export function getDatabase(): Database {
  const holder = services();
  holder.database ??= createPool();

  return holder.database;
}

/**
 * The process-wide sync service, created on first use. Kept apart from the pool so a missing
 * BGG variable breaks syncing only, not every page that reads Postgres.
 */
export function getSyncService(): CollectionSyncService {
  const holder = services();
  if (holder.syncService === undefined) {
    const userAgent = bggUserAgent();
    holder.syncService = new CollectionSyncService({
      database: getDatabase(),
      bgg: createBggClient({ userAgent, requestsPerSecond: GEEKDO_REQUESTS_PER_SECOND }),
      provider: createBggCollectionClient({
        userAgent,
        token: bggApiToken(),
        requestsPerSecond: XMLAPI_REQUESTS_PER_SECOND,
      }),
    });
  }

  return holder.syncService;
}
