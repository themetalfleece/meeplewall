---
name: local-infra
description: >-
  The local development services. Read before starting Postgres or minio,
  before editing infra/docker-compose.yml, and before adding or upgrading any
  container image. Covers how to bring the stack up, what each service stands
  in for, and why every image is pinned to an exact tag.
---

# Local infrastructure

`infra/docker-compose.yml` is for local development only. It is not a deployment artifact.

| Service    | Stands in for                 | Ports                      |
| ---------- | ----------------------------- | -------------------------- |
| `postgres` | the app's cache and store     | `5432`                     |
| `minio`    | Cloudflare R2 (S3-compatible) | `9000` API, `9001` console |

```bash
docker compose -f infra/docker-compose.yml up -d postgres minio minio-init
```

Both services have healthchecks, so `docker compose ps` reports `healthy` once they are ready. The credentials in the compose file are local-only defaults.

`minio-init` is a one-shot service: it waits for minio to be healthy, creates the `board-games` bucket if it is missing and makes its objects publicly readable, matching R2 behind its public URL. It exits once done, so `docker compose ps` does not list it. It reuses the minio image for the `mc` client bundled inside it, so there is no second image to pin. The `STORAGE_*` values in each `.env.example` point at this bucket. CI runs `up -d --wait minio` and then `run --rm minio-init` from the same file.

CI also runs `up -d --wait postgres` for the `packages/db` and `apps/image-processor` suites, so CI and local dev share one pinned Postgres image. If another project already holds port 5432 locally, run the same image on a spare port and point `DATABASE_URL` at it. To let a container reach it, attach it to the compose network with the `postgres` alias: `docker run -d --network board-games-dev_default --network-alias postgres -p 5433:5432 -e POSTGRES_USER=boardgames -e POSTGRES_PASSWORD=boardgames -e POSTGRES_DB=boardgames postgres:17.11-trixie`.

## App images

Each deployable app has an `infra/Dockerfile.<app>`, built from the repo root. Its build context is filtered by the root `.dockerignore`, which keeps out `node_modules`, `dist`, every `.env*` file at any depth and the legacy app's assets. Do not use a per-Dockerfile `<name>.dockerignore`: only BuildKit reads it, and the classic builder then copies the local `node_modules` and the install fails.

If `docker compose` reports `unknown shorthand flag: 'f'`, the compose CLI plugin is not registered in that shell. Docker Desktop on Windows also ships a standalone `docker-compose` binary that takes the same arguments.

## Pin every image to an exact tag

Never `:latest` or another floating tag. Otherwise two machines can run different builds with no diff to explain it, and `docker compose pull` can swap the image under an existing volume. A new image starts on its latest stable release (see `.agents/skills/package-management/`), pinned exactly.

A bare major such as `postgres:17` floats too. Postgres is pinned to minor and Debian release (`17.11-trixie`), because the plain `17.11` tag moves when the official image switches its base OS. Stay on the major the volume was initialised with: a major bump needs a dump and restore.

## minio comes from quay.io

minio's Docker Hub namespace is gone, so the image is `quay.io/minio/minio`. Its newest published community image predates its newest source release, so "latest stable" for minio means the newest tag on quay.io, not the newest GitHub release.
