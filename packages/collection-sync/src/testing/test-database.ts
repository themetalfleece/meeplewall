import type { Database } from '@meeplewall/db';
import { canReachPostgres, TestDatabase } from '@meeplewall/db/testing';
import { afterAll, beforeAll, beforeEach } from 'vitest';

/** The compose Postgres from DATABASE_URL, or undefined so the suite skips. CI never skips. */
export async function resolveTestServerUrl(): Promise<string | undefined> {
  const serverUrl = process.env.DATABASE_URL;
  if (serverUrl !== undefined && serverUrl !== '' && (await canReachPostgres(serverUrl))) {
    return serverUrl;
  }
  if (process.env.CI !== undefined) {
    throw new Error('CI must run the sync suite, but DATABASE_URL is unset or unreachable');
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
