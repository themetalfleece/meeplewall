import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import { closeDatabase, createDatabase, migrateDatabase } from '@board-games/db';
import { createStorage } from '@board-games/storage';

import { loadWorkerConfig } from './env.ts';
import { HealthServer } from './health-server.ts';
import { describeError, JsonLogger } from './logger.ts';
import { createRevalidate } from './revalidate.ts';
import { ImageWorker } from './worker.ts';

const HOLD_SECONDS = 60;
const IDLE_MILLISECONDS = 2_000;
const SOURCE_TIMEOUT_MILLISECONDS = 30_000;
const HEALTH_CHECK_TIMEOUT_MILLISECONDS = 2_000;

const logger = new JsonLogger({ write: (line) => process.stdout.write(line) });

async function main(): Promise<void> {
  const config = loadWorkerConfig();
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
  logger.error('Image processor crashed', { error: describeError(error) });
  process.exitCode = 1;
}
