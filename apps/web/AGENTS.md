# apps/web

`@meeplewall/web`: the Next.js 16 App Router site, a thin wrapper over `packages/*`. Read `.agents/skills/nextjs/` before changing a route, cache or config.

## How the routes render

- **Cache Components and Partial Prefetching are on.** No `export const revalidate`: a cached read is `'use cache'` plus `cacheLife` and `cacheTag`, and anything request-time sits in `<Suspense>` after `await connection()`.
- **Game reads are cached.** `loadGame` in `src/lib/games.ts` lives a day, tagged `game:<id>`. `POST /api/internal/revalidate` expires the tag when the image processor stores a cover.
- **Collection reads are not.** `/u/[uId]` and the nav on `/u/[uId]/g/[gId]` read Postgres per request, since syncs finish in another process.
- **The web app never calls BGG.** A stale or unknown user, or the refresh route, queues a sync with `requestCollectionSync` for `apps/sync-worker`. `SyncWatcher` polls `/api/sync/[uId]` and calls `router.refresh()` when it succeeds.
- **An unleased sync running past `SYNC_ABANDONED_AFTER_SECONDS` reads as failed.** `toSyncStatus` checks its age and lease, so a sync nobody picked up stops the polling, shows "Try again", and the next visit or refresh reclaims the row.
- **Not-found inside a streamed boundary answers 200** with `noindex`: the shell went out first. So 308s go in `src/proxy.ts`.

## Rules

- **`src/lib/env.ts` is the only `process.env` reader.** Next reads `apps/web/.env.local`; `.env.example` beside it lists every variable. `SITE_URL` is needed at build time too, since `/` is prerendered: without it `pnpm build` fails.
- **Pages call `src/lib` loaders, never `/api/...`.** Logic that is not Next-specific belongs in a package (`collection-sync`, `db`, `boardgamegeek`).
- **`src/lib/sync-status.ts` is client code.** `SyncWatcher` parses its schema, so it never imports a server package (see the `nextjs` skill).
- **Params arrive encoded.** Parse them with `parseUsername` and `parseGameId`; build links with `routes`, whose entries are all functions, fixed paths too.
- **The 3D box only gets the processed cover.** BGG's image CDN sends no CORS headers, so `toGameBoxInput` falls back to `public/placeholder-cover.png`, never a BGG URL.
- **Social images use BGG's original JPEG or PNG.** Their renderer cannot read WebP. `next/og` and the reads are imported inside the image function.
- **Postgres migrations are not run here.** The image processor and the sync worker apply them at startup, or run `pnpm --filter @meeplewall/db migrate`.

## Running it

- `pnpm --filter "@meeplewall/web..." build` builds the packages and the app. `pnpm --filter @meeplewall/web dev` serves it.
- `pnpm --filter @meeplewall/web start` runs `.next/standalone/apps/web/server.js`. Copy `public` and `.next/static` beside it first, as `apps/web/Dockerfile` does.
- `docker build -f apps/web/Dockerfile --build-arg SITE_URL=<origin> .` from the root.

## Tests

Vitest, next to each file. `src/lib` tests mock `@meeplewall/db`, `next/cache` and `next/server`; hook tests render with `react-dom/client` in jsdom.
