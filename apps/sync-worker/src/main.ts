import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import { createBggClient, createBggCollectionClient } from '@meeplewall/boardgamegeek';
import { CollectionSyncService } from '@meeplewall/collection-sync';
import { closeDatabase, createDatabase, migrateDatabase } from '@meeplewall/db';
import { describeError, HealthServer, JsonLogger } from '@meeplewall/worker-runtime';

import { loadWorkerConfig } from './env.ts';
import { databaseLeases, SyncWorker } from './worker.ts';

/** geekdo has no published limit; two a second is what the BGG skill settled on. */
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
const HEALTH_CHECK_TIMEOUT_MILLISECONDS = 2_000;

function writeLine(line: string): void {
  process.stdout.write(line);
}

// Reports a crash before LOG_LEVEL is known. Errors pass every level, so this drops nothing.
const crashLogger = new JsonLogger({ write: writeLine, level: 'error' });

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const logger = new JsonLogger({ write: writeLine, level: config.logLevel });
  const database = createDatabase({ connectionString: config.databaseUrl });
  database.$client.on('error', (error) => {
    logger.error('Idle database connection failed', { error: describeError(error) });
  });
  await migrateDatabase(database);

  const workerId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
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

  const healthServer = await HealthServer.start({
    port: config.healthPort,
    timeoutMilliseconds: HEALTH_CHECK_TIMEOUT_MILLISECONDS,
    check: async () => {
      if (worker.isStopping) {
        return false;
      }
      await database.$client.query('select 1');
      return true;
    },
  });

  const shutDown = (signal: NodeJS.Signals) => {
    logger.info('Stopping after the current sync', { signal });
    worker.stop();
  };
  process.once('SIGTERM', shutDown);
  process.once('SIGINT', shutDown);

  logger.info('Sync worker started', { workerId, healthPort: healthServer.port });
  await worker.run();

  await healthServer.close();
  await closeDatabase(database);
  logger.info('Sync worker stopped', { workerId });
}

try {
  await main();
} catch (error) {
  crashLogger.error('Sync worker crashed', { error: describeError(error) });
  process.exitCode = 1;
}
