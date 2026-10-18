import { closeDatabase, createDatabase, migrateDatabase } from '@meeplewall/db';
import { createStorage } from '@meeplewall/storage';
import { logIdleConnectionErrors, runWorkerProcess } from '@meeplewall/worker-runtime';

import { loadWorkerConfig } from './env.ts';
import { createRevalidate } from './revalidate.ts';
import { ImageWorker } from './worker.ts';

const HOLD_SECONDS = 60;
const IDLE_MILLISECONDS = 2_000;
const SOURCE_TIMEOUT_MILLISECONDS = 30_000;
// BGG originals are a few megabytes at most; anything far larger is not a cover.
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;

process.exitCode = await runWorkerProcess({
  name: 'Image processor',
  stoppingMessage: 'Stopping after the current job',
  loadConfig: loadWorkerConfig,
  start: async ({ config, logger, workerId }) => {
    const database = createDatabase({ connectionString: config.databaseUrl });
    logIdleConnectionErrors({ pool: database.$client, logger });
    await migrateDatabase(database);

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

    return {
      worker,
      ping: () => database.$client.query('select 1'),
      close: () => closeDatabase(database),
    };
  },
});
