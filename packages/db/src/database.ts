import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { drizzle, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';

import * as schema from './schema/index.ts';

// Resolves to the package's src/migrations from both src/ and the built dist/. Built with
// node:path rather than `new URL(..., import.meta.url)`, which bundlers such as Turbopack read
// as an asset import and fail to resolve.
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

/** Applies every migration that has not run yet, in order. */
export async function migrateDatabase(database: Database): Promise<void> {
  await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
}
