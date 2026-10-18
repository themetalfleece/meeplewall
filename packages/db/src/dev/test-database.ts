import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { closeDatabase, createDatabase, migrateDatabase, type Database } from '../database.ts';
import { readDatabaseUrl } from './database-url.ts';

async function canConnect(connectionString: string): Promise<boolean> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 3_000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

/**
 * The server connection string the database suites run against, or undefined
 * when Postgres is not configured or not reachable, so the suites skip. CI must
 * never skip them, so there an unreachable server throws instead.
 */
export async function resolveTestServerUrl(): Promise<string | undefined> {
  const connectionString = readDatabaseUrl();
  if (connectionString !== undefined && (await canConnect(connectionString))) {
    return connectionString;
  }
  if (process.env.CI !== undefined) {
    throw new Error('CI must run the database suites, but DATABASE_URL is unset or unreachable');
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
  const client = new pg.Client({ connectionString: serverUrl });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

/** A freshly migrated database of its own for one test file, dropped afterwards. */
export class TestDatabase {
  readonly database: Database;
  readonly #serverUrl: string;
  readonly #name: string;

  private constructor({
    database,
    serverUrl,
    name,
  }: {
    database: Database;
    serverUrl: string;
    name: string;
  }) {
    this.database = database;
    this.#serverUrl = serverUrl;
    this.#name = name;
  }

  static async create({ serverUrl }: { serverUrl: string }): Promise<TestDatabase> {
    const name = `meeplewall_test_${randomUUID().replaceAll('-', '')}`;
    await runServerStatement({ serverUrl, statement: `create database "${name}"` });

    const databaseUrl = new URL(serverUrl);
    databaseUrl.pathname = `/${name}`;
    const database = createDatabase({ connectionString: databaseUrl.toString() });
    await migrateDatabase(database);

    return new TestDatabase({ database, serverUrl, name });
  }

  /** Empties every table. Every other table cascades from these two. */
  async reset(): Promise<void> {
    await this.database.$client.query('truncate bgg_games, bgg_users cascade');
  }

  async destroy(): Promise<void> {
    await closeDatabase(this.database);
    await runServerStatement({
      serverUrl: this.#serverUrl,
      statement: `drop database if exists "${this.#name}" with (force)`,
    });
  }
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
