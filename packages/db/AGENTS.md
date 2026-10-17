# packages/db

`@board-games/db`: the Drizzle schema, migrations and repository helpers over Postgres.

## Rules

- **Never read `process.env` in the library.** `createDatabase({ connectionString })` takes its config; each app's env module reads `DATABASE_URL`. Only `src/dev/database-url.ts` reads it, for the scripts and tests, and `src/dev/` is left out of the build.
- **Row types come from Drizzle.** Use the `$inferSelect` / `$inferInsert` types exported next to each table in `src/schema/`. Never hand-write a row interface.
- **Migrations are forward-only.** Never edit or delete a migration that exists on `main`: the migrator records a hash per file and will not rerun it. Fix a mistake with a new migration.
- **Every helper takes a `DatabaseExecutor`**, so it runs on the pool or inside a caller's transaction.
- **Relative imports end in `.ts`.** Node runs the scripts with no build step, and `rewriteRelativeImportExtensions` turns them into `.js` in `dist/`.
- **An `ON CONFLICT` on a partial unique index repeats the index's `where` predicate**, or Postgres cannot infer the index and the insert fails.

## Changing the schema

1. Edit `src/schema/<table>.ts` (one file per table, re-exported from `src/schema/index.ts`).
2. `pnpm --filter @board-games/db generate --name <what_changed>` writes `src/migrations/<n>_<name>.sql` and its `meta/` snapshot. Commit both, unedited.
3. `pnpm --filter @board-games/db migrate` applies pending migrations to `DATABASE_URL`. Apps call `migrateDatabase(database)` at startup.

`pnpm --filter @board-games/db seed` loads a fixture user (`seed-user`) and four games. It is idempotent. Both scripts read `DATABASE_URL` from the repo root `.env.local`.

## Tests

Each test file gets its own throwaway database, migrated from scratch, through `useTestDatabase` in `src/dev/test-database.ts`. The suites skip when `DATABASE_URL` is unset or unreachable, except under `CI`, where they fail. The database user needs `CREATEDB`, which the compose user has.
