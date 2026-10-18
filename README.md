# Meeplewall

Board game collections from BoardGameGeek, shelved as 3D boxes, at
**[meeplewall.com](https://meeplewall.com/)**. Enter a BGG username and Meeplewall imports the
collection, then shows each game as a box you can browse, open and turn over.

The source code is MIT licensed (see [LICENSE](LICENSE)). Game data, names and box art
belong to BoardGameGeek and the games' publishers and are not covered by that license.
Meeplewall is not affiliated with or endorsed by BoardGameGeek.

## Layout

A pnpm workspaces monorepo. Each workspace has an `AGENTS.md` with its own rules.

| Workspace                  | What it is                                                                        |
| -------------------------- | --------------------------------------------------------------------------------- |
| `apps/web`                 | the Next.js site                                                                  |
| `apps/sync-worker`         | imports BGG collections; the only process that calls BGG                          |
| `apps/image-processor`     | turns BGG covers into box textures and uploads them                               |
| `packages/boardgamegeek`   | the BGG client and the box-size cross-check                                       |
| `packages/collection-sync` | queues and runs collection syncs                                                  |
| `packages/db`              | the Drizzle schema, migrations and repositories over Postgres                     |
| `packages/image-pipeline`  | image processing over Sharp                                                       |
| `packages/renderer`        | the Three.js game box and its React wrapper                                       |
| `packages/storage`         | the S3-compatible client for R2 and the local minio                               |
| `packages/worker-runtime`  | logging, health checks, the poll loop and the process lifecycle the workers share |
| `packages/config`          | the shared TypeScript, ESLint and Prettier config                                 |

The product goals and the look are in [`docs/PLAN.md`](docs/PLAN.md).

## Developing

Requires Node 22 or newer (24.2 or newer for the agent doc checks) and pnpm, whose version is
pinned in `package.json`.

```bash
pnpm install
docker compose up -d postgres minio minio-init   # local Postgres and an R2 stand-in
```

Copy each app's `.env.example` to `.env.local` beside it and fill it in; the app's `AGENTS.md`
says which values matter locally. Then:

```bash
pnpm build                               # every package and app
pnpm --filter @meeplewall/web dev        # the site
pnpm --filter @meeplewall/sync-worker dev
pnpm --filter @meeplewall/image-processor dev
```

Before sending a change, run the gate in this order, as CI does:

```bash
pnpm format:write && pnpm format
pnpm build && pnpm lint && pnpm typecheck && pnpm test
pnpm validate && pnpm test:scripts   # Node 24.2 or newer
```

## Deploying

Production runs on [Dokploy](https://dokploy.com), which builds each app straight from its
Dockerfile. No images are published; CI only checks that every Dockerfile still builds. Point a
Dokploy application at each Dockerfile with the repo root as the build context, and give all three
the same Postgres and R2 bucket:

| App               | Dockerfile                        | Role                                                | Health check           |
| ----------------- | --------------------------------- | --------------------------------------------------- | ---------------------- |
| `web`             | `apps/web/Dockerfile`             | the Next.js site, on port 3000                      | `GET /healthz` on 3000 |
| `image-processor` | `apps/image-processor/Dockerfile` | turns BGG covers into box textures and uploads them | `GET /healthz` on 8080 |
| `sync-worker`     | `apps/sync-worker/Dockerfile`     | imports BGG collections; run exactly one            | `GET /healthz` on 8081 |

Each health check answers 200 while the process runs and Postgres responds, and each image's
`HEALTHCHECK` polls it. The images run as the non-root `node` user. Logs are one JSON object per
line on stdout and stderr, filtered by `LOG_LEVEL`. Both workers apply database migrations on
start.

### Environment

Every variable is required; nothing falls back to a default. Each app's `.env.example` describes
its values.

| Variable                      | web | image-processor | sync-worker | Notes                                           |
| ----------------------------- | :-: | :-------------: | :---------: | ----------------------------------------------- |
| `SITE_URL`                    |  ✓  |                 |             | `https://meeplewall.com`; also a build arg      |
| `DATABASE_URL`                |  ✓  |        ✓        |      ✓      | the shared Postgres                             |
| `STORAGE_PUBLIC_BASE_URL`     |  ✓  |        ✓        |             | the R2 bucket's public URL                      |
| `STORAGE_ENDPOINT`            |     |        ✓        |             | `https://<account id>.r2.cloudflarestorage.com` |
| `STORAGE_ACCESS_KEY_ID`       |     |        ✓        |             | R2 API token with read and write on the bucket  |
| `STORAGE_SECRET_ACCESS_KEY`   |     |        ✓        |             |                                                 |
| `STORAGE_BUCKET`              |     |        ✓        |             |                                                 |
| `STORAGE_FORCE_PATH_STYLE`    |     |        ✓        |             | `false` for R2                                  |
| `INTERNAL_REVALIDATE_SECRET`  |  ✓  |        ✓        |             | the same value in both                          |
| `WEB_INTERNAL_URL`            |     |        ✓        |             | where the worker reaches `web`                  |
| `IMAGE_PROCESSOR_HEALTH_PORT` |     |        ✓        |             | `8080`                                          |
| `BGG_USER_AGENT`              |     |                 |      ✓      | names the app and a contact                     |
| `BGG_API_TOKEN`               |     |                 |      ✓      | from boardgamegeek.com/applications             |
| `SYNC_WORKER_HEALTH_PORT`     |     |                 |      ✓      | `8081`                                          |
| `LOG_LEVEL`                   |  ✓  |        ✓        |      ✓      | `info`, `warn` or `error`                       |

The web image renders its static pages at build time, so pass `SITE_URL` as a build arg as well
as a runtime variable, with the same value.
