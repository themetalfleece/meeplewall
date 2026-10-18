import { createBggClient, createBggCollectionClient } from '@meeplewall/boardgamegeek';
import { CollectionSyncService } from '@meeplewall/collection-sync';
import { closeDatabase, createDatabase, migrateDatabase } from '@meeplewall/db';
import { logIdleConnectionErrors, runWorkerProcess } from '@meeplewall/worker-runtime';

import { loadWorkerConfig } from './env.ts';
import { databaseLeases, SyncWorker } from './worker.ts';

/** geekdo publishes no limit, so the worker keeps to a polite two a second. */
const GEEKDO_REQUESTS_PER_SECOND = 2;
/** XMLAPI2 asks for a few seconds between requests, and a sync makes only one. */
const XMLAPI_REQUESTS_PER_SECOND = 0.2;
// A sync can run for minutes, so the lease is short and renewed: a crashed worker's sync is
// picked up again within a minute rather than after the whole run.
const HOLD_SECONDS = 60;
const RENEW_MILLISECONDS = 20_000;
// A sync that loses its lease this many times, most likely by crashing the worker, is failed.
const MAX_ATTEMPTS = 3;
const IDLE_MILLISECONDS = 2_000;

process.exitCode = await runWorkerProcess({
  name: 'Sync worker',
  stoppingMessage: 'Stopping after the current sync',
  loadConfig: loadWorkerConfig,
  start: async ({ config, logger, workerId }) => {
    const database = createDatabase({ connectionString: config.databaseUrl });
    logIdleConnectionErrors({ pool: database.$client, logger });
    await migrateDatabase(database);

    const worker = new SyncWorker({
      leases: databaseLeases({
        database,
        workerId,
        holdSeconds: HOLD_SECONDS,
        maxAttempts: MAX_ATTEMPTS,
      }),
      runner: new CollectionSyncService({
        database,
        bgg: createBggClient({
          userAgent: config.bggUserAgent,
          requestsPerSecond: GEEKDO_REQUESTS_PER_SECOND,
        }),
        provider: createBggCollectionClient({
          userAgent: config.bggUserAgent,
          token: config.bggApiToken,
          requestsPerSecond: XMLAPI_REQUESTS_PER_SECOND,
        }),
      }),
      logger,
      workerId,
      renewMilliseconds: RENEW_MILLISECONDS,
      idleMilliseconds: IDLE_MILLISECONDS,
    });

    return {
      worker,
      ping: () => database.$client.query('select 1'),
      close: () => closeDatabase(database),
    };
  },
});
