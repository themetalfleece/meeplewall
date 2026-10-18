import { randomUUID } from 'node:crypto';

import { closeDatabase, createDatabase, migrateDatabase, type Database } from '@board-games/db';
import { afterAll, beforeAll, beforeEach } from 'vitest';

/** The compose Postgres from DATABASE_URL, or undefined so the suite skips. CI never skips. */
export async function resolveTestServerUrl(): Promise<string | undefined> {
  const serverUrl = process.env.DATABASE_URL;
  if (serverUrl !== undefined && serverUrl !== '') {
    const probe = createDatabase({ connectionString: serverUrl });
    try {
      await probe.$client.query('select 1');
      return serverUrl;
    } catch {
      // Unreachable: fall through to skip, or to fail under CI.
    } finally {
      await closeDatabase(probe);
    }
  }
  if (process.env.CI !== undefined) {
    throw new Error('CI must run the sync suite, but DATABASE_URL is unset or unreachable');
  }

  return undefined;
}

async function runServerStatement({
  serverUrl,
  statement,
}: {
  serverUrl: string;
  statement: string;
}): Promise<void> {
  const server = createDatabase({ connectionString: serverUrl });
  try {
    await server.$client.query(statement);
  } finally {
    await closeDatabase(server);
  }
}

/**
 * Gives the enclosing suite its own migrated database, emptied before each test.
 * Call it inside a `describe.skipIf(serverUrl === undefined)` block.
 */
export function useTestDatabase(serverUrl: string | undefined): () => Database {
  const name = `collection_sync_test_${randomUUID().replaceAll('-', '')}`;
  let database: Database | undefined;

  beforeAll(async () => {
    if (serverUrl === undefined) {
      throw new Error('useTestDatabase ran without a server; wrap the suite in describe.skipIf');
    }
    await runServerStatement({ serverUrl, statement: `create database "${name}"` });
    const databaseUrl = new URL(serverUrl);
    databaseUrl.pathname = `/${name}`;
    database = createDatabase({ connectionString: databaseUrl.toString() });
    await migrateDatabase(database);
  });
  beforeEach(async () => {
    // Every other table cascades from these two.
    await database?.$client.query('truncate bgg_games, bgg_users cascade');
  });
  afterAll(async () => {
    if (database !== undefined) {
      await closeDatabase(database);
    }
    if (serverUrl !== undefined) {
      await runServerStatement({
        serverUrl,
        statement: `drop database if exists "${name}" with (force)`,
      });
    }
  });

  return () => {
    if (database === undefined) {
      throw new Error('The test database is only available inside a test');
    }
    return database;
  };
}
