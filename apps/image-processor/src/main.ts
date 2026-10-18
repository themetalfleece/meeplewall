import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import { closeDatabase, createDatabase, migrateDatabase } from '@meeplewall/db';
import { createStorage } from '@meeplewall/storage';
import { describeError, HealthServer, JsonLogger } from '@meeplewall/worker-runtime';

import { loadWorkerConfig } from './env.ts';
import { createRevalidate } from './revalidate.ts';
import { ImageWorker } from './worker.ts';

const HOLD_SECONDS = 60;
const IDLE_MILLISECONDS = 2_000;
const SOURCE_TIMEOUT_MILLISECONDS = 30_000;
// BGG originals are a few megabytes at most; anything far larger is not a cover.
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
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
  const worker = new ImageWorker({
    database,
    storage: createStorage(config.storage),
    revalidate: createRevalidate({
      webInternalUrl: config.webInternalUrl,
      secret: config.revalidateSecret,
    }),
    logger,
    workerId,
    holdSeconds: HOLD_SECONDS,
    idleMilliseconds: IDLE_MILLISECONDS,
    sourceTimeoutMilliseconds: SOURCE_TIMEOUT_MILLISECONDS,
    maxSourceBytes: MAX_SOURCE_BYTES,
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
    logger.info('Stopping after the current job', { signal });
    worker.stop();
  };
  process.once('SIGTERM', shutDown);
  process.once('SIGINT', shutDown);

  logger.info('Image processor started', { workerId, healthPort: healthServer.port });
  await worker.run();

  await healthServer.close();
  await closeDatabase(database);
  logger.info('Image processor stopped', { workerId });
}

try {
  await main();
} catch (error) {
  crashLogger.error('Image processor crashed', { error: describeError(error) });
  process.exitCode = 1;
}
