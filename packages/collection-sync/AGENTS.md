# packages/collection-sync

`@meeplewall/collection-sync`: keeps stored collections in step with BGG. `CollectionSyncService` takes a database, a geekdo `BggClient` and a `CollectionProvider` (the XMLAPI2 collection client fits it as is). Framework-agnostic: the app decides where a started sync runs.

## What a sync does

1. `requestSync({ username })` starts a sync, joins the running one, or declines with `retryAfterSeconds` when the user's latest sync started under `SYNC_THROTTLE_SECONDS` ago. Manual refreshes and visit-triggered syncs share that limit.
2. `runSync({ sync, username, source })` fetches the collection, fetches every game missing from `bgg_games` or older than `GAME_MAX_AGE_SECONDS`, replaces the stored collection sorted by game name, and queues a `cover` and `thumb` job for each image not yet processed.
3. It finishes the `collection_syncs` row and writes `refresh_log`. A BGG failure becomes the `failed` outcome and leaves the previous collection untouched; it never throws for one.

`source` is `user` for the refresh button and `api` for a sync the app starts on a visit.

## Rules

- **Never read `process.env`.** Everything arrives through the constructor.
- **A game BGG does not know is dropped**, not stored as a stub.
- **Freshness lives in `src/freshness.ts`.** Change the windows there, not at call sites.

## Tests

`collection-sync-service.test.ts` runs against a throwaway database on the compose Postgres (`DATABASE_URL` from this package's `.env.local`, or the shell) with fake BGG clients from `src/testing/`. It skips when Postgres is down, and fails instead under `CI`.
