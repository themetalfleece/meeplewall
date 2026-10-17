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
docker compose -f infra/docker-compose.yml up -d postgres minio
```

Both services have healthchecks, so `docker compose ps` reports `healthy` once they are ready. The credentials in the compose file are local-only defaults.

## Pin every image to an exact tag

Never `:latest` or another floating tag. Otherwise two machines can run different builds with no diff to explain it, and `docker compose pull` can swap the image under an existing volume. A new image starts on its latest stable release (see `.agents/skills/package-management/`), pinned exactly.

## minio comes from quay.io

minio's Docker Hub namespace is gone, so the image is `quay.io/minio/minio`. Its newest published community image predates its newest source release, so "latest stable" for minio means the newest tag on quay.io, not the newest GitHub release.
