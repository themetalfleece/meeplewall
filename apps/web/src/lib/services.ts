import { createDatabase, type Database } from '@meeplewall/db';

import { databaseUrl } from './env';
import { logError } from './logger';

interface Services {
  database?: Database;
}

declare global {
  // Kept on globalThis so a dev hot reload reuses the pool instead of opening another.
  var meeplewallServices: Services | undefined;
}

function services(): Services {
  globalThis.meeplewallServices ??= {};

  return globalThis.meeplewallServices;
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
