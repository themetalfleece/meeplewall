import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { closeDatabase, createDatabase, migrateDatabase } from './database.ts';
import { resolveTestServerUrl, useTestDatabase } from './dev/test-database.ts';

const serverUrl = await resolveTestServerUrl();

describe.skipIf(serverUrl === undefined)('migrateDatabase', () => {
  const database = useTestDatabase(serverUrl);

  it('creates every table', async () => {
    const result = await database().$client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' order by table_name`,
    );

    expect(result.rows.map((row) => row.table_name)).toEqual([
      'bgg_games',
      'bgg_users',
      'collection_items',
      'collection_syncs',
      'image_assets',
      'image_jobs',
      'refresh_log',
      'user_collections',
    ]);
  });

  it('is a no-op when every migration has already run', async () => {
    await expect(migrateDatabase(database())).resolves.toBeUndefined();
  });
});

describe.skipIf(serverUrl === undefined)('migrateDatabase from two processes at once', () => {
  const name = `meeplewall_test_${randomUUID().replaceAll('-', '')}`;

  async function runServerStatement(statement: string) {
    const client = new pg.Client({ connectionString: serverUrl });
    await client.connect();
    try {
      await client.query(statement);
    } finally {
      await client.end();
    }
  }

  afterAll(async () => {
    await runServerStatement(`drop database if exists "${name}" with (force)`);
  });

  it('applies every migration exactly once', async () => {
    await runServerStatement(`create database "${name}"`);
    const databaseUrl = new URL(serverUrl ?? '');
    databaseUrl.pathname = `/${name}`;
    const pools = [1, 2].map(() => createDatabase({ connectionString: databaseUrl.toString() }));

    try {
      await Promise.all(pools.map((pool) => migrateDatabase(pool)));
      const applied = await pools[0]?.$client.query(
        'select hash from drizzle.__drizzle_migrations',
      );
      const files = await readdir(path.join(import.meta.dirname, 'migrations'));

      expect(applied?.rowCount).toBe(files.filter((file) => file.endsWith('.sql')).length);
    } finally {
      await Promise.all(pools.map((pool) => closeDatabase(pool)));
    }
  });
});
