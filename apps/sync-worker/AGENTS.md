# apps/sync-worker

`@meeplewall/sync-worker`: the only process that calls BGG. It drains the `collection_syncs` rows apps/web queues, running each through `CollectionSyncService` from `packages/collection-sync`.

## Running it locally

1. Start Postgres (`.agents/skills/local-infra/`). Copy `apps/sync-worker/.env.example` to `.env.local` beside it and set `BGG_API_TOKEN`. A missing variable stops the worker at startup.
2. `pnpm --filter @meeplewall/sync-worker... build` once, so the workspace packages have a `dist/`.
3. `pnpm --filter @meeplewall/sync-worker dev` runs `src/main.ts`, applying pending migrations first.
4. Visit `/u/<bgg username>` on apps/web, or `POST /api/refresh/<bgg username>`, to queue a sync.

Container: `docker build -f apps/sync-worker/Dockerfile .` from the root, then run it on `meeplewall-dev_default` with `postgres` as the hostname.

## Sync lifecycle

1. **Claim.** The oldest `running` sync no worker holds is leased for 60 seconds, and `attempts` goes up by one.
2. **Run.** `runSync` fetches from BGG and stores the result. The lease is renewed every 20 seconds while it runs, so a long cold collection keeps it.
3. **Finish.** The row becomes `succeeded` or `failed` and the lease is released. If the lease was lost meanwhile, the stored collection stands but finishing the row is left to the new holder.
4. **Crash.** A worker that dies mid-sync stops renewing, so its lease runs out within a minute and another claim picks the sync up. After 3 attempts the sync is failed with `Gave up after 3 attempts`.

SIGTERM or SIGINT stops the loop after the sync in hand, then the health server and the pool close, through `runWorkerProcess` from `packages/worker-runtime`. That can take minutes; a container killed sooner leaves the lease to run out, and the sync is retried.

## Rules

- **Run exactly one.** The BGG rate limit lives in the process, so a second worker doubles the load on BGG. Leases keep two from running the same sync, not from exceeding the limit.
- **`src/env.ts` is the only `process.env` reader.** No defaults.
- **`/healthz` is 200 only while the loop runs and Postgres answers within 2 seconds.**

## Tests

`worker.test.ts` drives `SyncWorker` with fake leases and a fake runner, with fake timers for the lease renewal. The claim and lease queries are covered against Postgres in `packages/db`, and `runSync` in `packages/collection-sync`.
