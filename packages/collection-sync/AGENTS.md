# packages/collection-sync

`@meeplewall/collection-sync`: keeps stored collections in step with BGG, in two halves. `requestCollectionSync` queues a sync and touches only the database, so apps/web calls it. `CollectionSyncService` runs one against BGG; it takes a database, a geekdo `BggClient` and a `CollectionProvider` (the XMLAPI2 collection client fits it as is), and only `apps/sync-worker` builds one. Framework-agnostic.

## What a sync does

1. `requestCollectionSync(database, { username, source })` queues a `collection_syncs` row, joins the running one, or declines with `retryAfterSeconds` when the user's latest sync started under `SYNC_THROTTLE_SECONDS` ago. Manual refreshes and visit-triggered syncs share that limit.
2. The sync worker claims the row with a lease (`claimNextCollectionSync` in `packages/db`) and calls `runSync({ claimed, workerId })`. It fetches the collection, fetches every game missing from `bgg_games` or older than `GAME_MAX_AGE_SECONDS`, replaces the stored collection sorted by game name, and queues a `cover` and `thumb` job for each image not yet processed.
3. It finishes the row and writes `refresh_log`. A BGG failure becomes the `failed` outcome and leaves the previous collection untouched; it never throws for one. When the worker lost the lease meanwhile, it returns `lost` and records nothing, since the new holder will.

`source` is `user` for the refresh button and `api` for a sync the app starts on a visit. It is stored on the row, so the worker logs it without being told.

## Rules

- **Never read `process.env`.** Everything arrives as an argument or through the constructor.
- **A game BGG does not know is dropped**, not stored as a stub.
- **Freshness lives in `src/freshness.ts`.** Change the windows there, not at call sites.

## Tests

`collection-sync-service.test.ts` and `request-sync.test.ts` run against a throwaway database on the compose Postgres (`DATABASE_URL` from this package's `.env.local`, or the shell) with fake BGG clients from `src/testing/`. They skip when Postgres is down, and fail instead under `CI`.
