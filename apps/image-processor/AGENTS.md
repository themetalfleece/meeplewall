# apps/image-processor

`@meeplewall/image-processor`: the worker that drains `image_jobs`. It downloads a game's cover, renders it with `image-pipeline`, uploads it with `storage`, records the asset with `db`, then asks apps/web to re-render the game's pages.

## Running it locally

1. Start Postgres and minio (`.agents/skills/local-infra/`). Copy `apps/image-processor/.env.example` to `.env.local` beside it and set `INTERNAL_REVALIDATE_SECRET` to the value in `apps/web/.env.local`. A missing variable stops the worker at startup.
2. `pnpm --filter @meeplewall/image-processor... build` once, so the workspace packages have a `dist/`.
3. `pnpm --filter @meeplewall/image-processor dev` runs `src/main.ts`, applying pending migrations first.
4. Queue work: set a game's `image_url_raw` to a BGG `original` image URL and insert one `image_jobs` row per kind. The seed games have no image URL, so their jobs fail.

Container: `docker build -f apps/image-processor/Dockerfile .` from the root, then run it on `meeplewall-dev_default` with `postgres` and `minio` as hostnames.

## Job lifecycle

1. **Claim.** The oldest `pending` job, or a `processing` one whose lease ran out, is leased for 60 seconds.
2. **Render.** The source is `bgg_games.image_url_raw`. A job is one size (`cover` or `thumb`); only that size is uploaded and recorded.
3. **Upload.** Key `covers/<bggGameId>.<digest>.webp` (or `.thumb.webp`), the digest hashing the bytes, because objects are cached `immutable` for a year. Read keys from `image_assets.storage_key`; never rebuild them.
4. **Ready.** The asset and colours are stored with the status in one transaction. An undefined result means another worker took the lease.
5. **Revalidate.** `POST {WEB_INTERNAL_URL}/api/internal/revalidate`, `Authorization: Bearer {INTERNAL_REVALIDATE_SECRET}`, body `{ "bggGameId": n }`. A failure is logged, not fatal: the asset is stored.
6. **Failure.** Any earlier error marks the job `failed` for good, the message in `last_error` (`Source fetch failed with 404`). Re-enqueue to retry.

SIGTERM or SIGINT stops the loop after the job in hand, closes the health server and pool, and exits 0. The loop, logger, health server and this process lifecycle (`runWorkerProcess`) come from `packages/worker-runtime`.

## Rules

- **`src/env.ts` is the only `process.env` reader.** No defaults.
- **A download is capped** at 30 seconds and 32 MB, well inside the lease.
- **`/healthz` is 200 only while the loop runs and Postgres answers within 2 seconds.**

## Tests

`worker.e2e.test.ts` runs against the compose Postgres and minio in a throwaway database, with `src/testing/stub-server.ts` serving the cover and playing the revalidate route. It skips when a service is down, and fails instead under `CI`. Anything that needs only HTTP, such as the download caps in `download-source.test.ts`, stays in a plain suite against the stub.
