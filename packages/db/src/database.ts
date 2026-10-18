import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { drizzle, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';

import * as schema from './schema/index.ts';

// The package's src/migrations, from both src/ and dist/. Built with node:path because Turbopack
// reads `new URL(..., import.meta.url)` as an asset import and fails.
const MIGRATIONS_FOLDER = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  'src',
  'migrations',
);

/**
 * Opens a long-lived connection pool. Call once per process and share the result.
 *
 * The pool emits `error` when an idle connection drops. Attach a listener on
 * `database.$client` to log it, otherwise Node treats it as an uncaught error.
 */
export function createDatabase({ connectionString }: { connectionString: string }) {
  const pool = new pg.Pool({ connectionString });

  return drizzle({ client: pool, schema });
}

export type Database = ReturnType<typeof createDatabase>;

/** A database or an open transaction. Every repository helper accepts either. */
export type DatabaseExecutor = PgDatabase<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/** Closes every connection in the pool. */
export async function closeDatabase(database: Database): Promise<void> {
  await database.$client.end();
}

// An arbitrary key every process agrees on, held while it migrates.
const MIGRATION_LOCK_KEY = 4_118_652_201;

/**
 * Applies every migration that has not run yet, in order. Each worker calls it at
 * startup, so it holds a Postgres advisory lock: a second caller waits, then finds
 * nothing left to apply.
 */
export async function migrateDatabase(database: Database): Promise<void> {
  const client = await database.$client.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await migrate(drizzle({ client, schema }), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    // Closing the connection drops the lock with it, even when the migration failed midway.
    client.release(true);
  }
}
