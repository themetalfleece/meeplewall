import { randomUUID } from 'node:crypto';

import { closeDatabase, createDatabase, migrateDatabase, type Database } from '@board-games/db';
import { createStorage, type Storage } from '@board-games/storage';
import pg from 'pg';

import { isContinuousIntegration, readServiceConfig, type ServiceConfig } from '../env.ts';

async function canReachPostgres(connectionString: string): Promise<boolean> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 3_000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function canReachStorage(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(new URL('/minio/health/live', endpoint), {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * The compose Postgres and minio, or undefined when either is unset or down so
 * the suite skips. Under CI a missing service throws instead.
 */
export async function resolveTestServices(): Promise<ServiceConfig | undefined> {
  const config = readServiceConfig();
  const reachable =
    config !== undefined &&
    (await canReachPostgres(config.databaseUrl)) &&
    (await canReachStorage(config.storage.endpoint));
  if (reachable) {
    return config;
  }
  if (isContinuousIntegration()) {
    throw new Error('CI must run the worker suite, but Postgres or minio is unset or unreachable');
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

/**
 * A freshly migrated database of its own, so the worker never claims jobs that
 * belong to another suite or to local data, plus a client for the bucket.
 */
export class TestServices {
  readonly database: Database;
  readonly storage: Storage;
  readonly #serverUrl: string;
  readonly #databaseName: string;

  private constructor({
    database,
    storage,
    serverUrl,
    databaseName,
  }: {
    database: Database;
    storage: Storage;
    serverUrl: string;
    databaseName: string;
  }) {
    this.database = database;
    this.storage = storage;
    this.#serverUrl = serverUrl;
    this.#databaseName = databaseName;
  }

  static async create(config: ServiceConfig): Promise<TestServices> {
    const databaseName = `image_processor_test_${randomUUID().replaceAll('-', '')}`;
    await runServerStatement({
      serverUrl: config.databaseUrl,
      statement: `create database "${databaseName}"`,
    });

    const databaseUrl = new URL(config.databaseUrl);
    databaseUrl.pathname = `/${databaseName}`;
    const database = createDatabase({ connectionString: databaseUrl.toString() });
    await migrateDatabase(database);

    return new TestServices({
      database,
      storage: createStorage(config.storage),
      serverUrl: config.databaseUrl,
      databaseName,
    });
  }

  /** Empties every table. Every other table cascades from these two. */
  async reset(): Promise<void> {
    await this.database.$client.query('truncate bgg_games, bgg_users cascade');
  }

  async destroy(): Promise<void> {
    await closeDatabase(this.database);
    await runServerStatement({
      serverUrl: this.#serverUrl,
      statement: `drop database if exists "${this.#databaseName}" with (force)`,
    });
  }
}
