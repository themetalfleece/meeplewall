import { afterAll, beforeAll, beforeEach } from 'vitest';

import type { Database } from '../database.ts';
import { canReachPostgres, TestDatabase } from '../testing/test-database.ts';
import { readDatabaseUrl } from './database-url.ts';

/**
 * The server connection string the database suites run against, or undefined
 * when Postgres is not configured or not reachable, so the suites skip. CI must
 * never skip them, so there an unreachable server throws instead.
 */
export async function resolveTestServerUrl(): Promise<string | undefined> {
  const connectionString = readDatabaseUrl();
  if (connectionString !== undefined && (await canReachPostgres(connectionString))) {
    return connectionString;
  }
  if (process.env.CI !== undefined) {
    throw new Error('CI must run the database suites, but DATABASE_URL is unset or unreachable');
  }

  return undefined;
}

/**
 * Gives the enclosing suite its own migrated database, emptied before each test.
 * Call it inside a `describe.skipIf(serverUrl === undefined)` block.
 */
export function useTestDatabase(serverUrl: string | undefined): () => Database {
  let testDatabase: TestDatabase | undefined;

  beforeAll(async () => {
    if (serverUrl === undefined) {
      throw new Error('useTestDatabase ran without a server; wrap the suite in describe.skipIf');
    }
    testDatabase = await TestDatabase.create({ serverUrl });
  });
  beforeEach(async () => {
    await testDatabase?.reset();
  });
  afterAll(async () => {
    await testDatabase?.destroy();
  });

  return () => {
    if (testDatabase === undefined) {
      throw new Error('The test database is only available inside a test');
    }
    return testDatabase.database;
  };
}
