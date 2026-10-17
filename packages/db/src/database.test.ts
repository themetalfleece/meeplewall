import { describe, expect, it } from 'vitest';

import { migrateDatabase } from './database.ts';
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
