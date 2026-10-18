import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { closeDatabase, createDatabase, migrateDatabase } from './database.ts';
import { resolveTestServerUrl, useTestDatabase } from './dev/test-database.ts';
import { ScratchDatabase } from './testing/test-database.ts';

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
  let scratch: ScratchDatabase | undefined;

  afterAll(async () => {
    await scratch?.drop();
  });

  it('applies every migration exactly once', async () => {
    if (serverUrl === undefined) {
      throw new Error('The suite ran without a server; it should have been skipped');
    }
    scratch = await ScratchDatabase.create({ serverUrl });
    const { connectionString } = scratch;
    const pools = [1, 2].map(() => createDatabase({ connectionString }));

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
