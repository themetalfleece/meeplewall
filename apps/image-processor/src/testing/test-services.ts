import type { Database } from '@meeplewall/db';
import { canReachPostgres, TestDatabase } from '@meeplewall/db/testing';
import { createStorage, type Storage } from '@meeplewall/storage';

import { isContinuousIntegration, readServiceConfig, type ServiceConfig } from '../env.ts';

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

/**
 * A freshly migrated database of its own, so the worker never claims jobs that
 * belong to another suite or to local data, plus a client for the bucket.
 */
export class TestServices {
  readonly storage: Storage;
  readonly #testDatabase: TestDatabase;

  private constructor({ testDatabase, storage }: { testDatabase: TestDatabase; storage: Storage }) {
    this.#testDatabase = testDatabase;
    this.storage = storage;
  }

  static async create(config: ServiceConfig): Promise<TestServices> {
    const testDatabase = await TestDatabase.create({ serverUrl: config.databaseUrl });

    return new TestServices({ testDatabase, storage: createStorage(config.storage) });
  }

  get database(): Database {
    return this.#testDatabase.database;
  }

  /** Empties every table. */
  async reset(): Promise<void> {
    await this.#testDatabase.reset();
  }

  async destroy(): Promise<void> {
    await this.#testDatabase.destroy();
  }
}
