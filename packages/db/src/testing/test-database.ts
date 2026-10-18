import { randomUUID } from 'node:crypto';

import pg from 'pg';

import { closeDatabase, createDatabase, migrateDatabase, type Database } from '../database.ts';

/** True when a Postgres server answers at `connectionString` within 3 seconds. */
export async function canReachPostgres(connectionString: string): Promise<boolean> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 3_000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
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

/** An empty database of its own on the server at `serverUrl`, for one suite to migrate and drop. */
export class ScratchDatabase {
  /** Connects to the scratch database rather than the server's default one. */
  readonly connectionString: string;
  readonly #serverUrl: string;
  readonly #name: string;

  private constructor({ serverUrl, name }: { serverUrl: string; name: string }) {
    const databaseUrl = new URL(serverUrl);
    databaseUrl.pathname = `/${name}`;

    this.connectionString = databaseUrl.toString();
    this.#serverUrl = serverUrl;
    this.#name = name;
  }

  static async create({ serverUrl }: { serverUrl: string }): Promise<ScratchDatabase> {
    const name = `meeplewall_test_${randomUUID().replaceAll('-', '')}`;
    await runServerStatement({ serverUrl, statement: `create database "${name}"` });

    return new ScratchDatabase({ serverUrl, name });
  }

  /** Drops the database, closing any connection still open to it. */
  async drop(): Promise<void> {
    await runServerStatement({
      serverUrl: this.#serverUrl,
      statement: `drop database if exists "${this.#name}" with (force)`,
    });
  }
}

/** A freshly migrated scratch database with an open pool, for one test file. */
export class TestDatabase {
  readonly database: Database;
  readonly #scratch: ScratchDatabase;

  private constructor({ database, scratch }: { database: Database; scratch: ScratchDatabase }) {
    this.database = database;
    this.#scratch = scratch;
  }

  static async create({ serverUrl }: { serverUrl: string }): Promise<TestDatabase> {
    const scratch = await ScratchDatabase.create({ serverUrl });
    const database = createDatabase({ connectionString: scratch.connectionString });
    await migrateDatabase(database);

    return new TestDatabase({ database, scratch });
  }

  /** Empties every table. Every other table cascades from these two. */
  async reset(): Promise<void> {
    await this.database.$client.query('truncate bgg_games, bgg_users cascade');
  }

  /** Closes the pool and drops the database. */
  async destroy(): Promise<void> {
    await closeDatabase(this.database);
    await this.#scratch.drop();
  }
}
