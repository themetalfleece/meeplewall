# packages/storage

`@meeplewall/storage`: an S3-compatible client for one bucket. Production points it at Cloudflare R2, local dev at the compose minio, through the same code and the same `STORAGE_*` variables.

## Rules

- **Never read `process.env` here.** `createStorage` takes every option as an argument and validates it with Zod. The app's env module maps `STORAGE_*` onto the options, including parsing `STORAGE_FORCE_PATH_STYLE` into a boolean.
- **No option has a default.** A missing or malformed one throws, naming the field.
- **The region is always `auto`.** R2 rejects anything that is not `auto` or an alias of it, and minio accepts any region unless one is configured. Do not make it an option.
- **`endpoint` and `publicBaseUrl` must be `http(s)` URLs.** A bare `z.url()` accepts `localhost:9000`, reading `localhost:` as the scheme.
- **`headObject` returns `null` for a missing key** and rethrows every other error. `deleteObject` on a missing key succeeds, as S3 delete does.
- **`getPublicUrl` makes no request.** It percent-encodes each key segment and keeps the slashes.

## Tests

`storage.test.ts` covers option validation and URL building offline. `storage.e2e.test.ts` round-trips against the compose minio and skips when the `STORAGE_*` variables are unset or minio is down. `vitest.config.ts` loads `STORAGE_*` from this package's `.env.local`, so copying `.env.example` beside it and starting minio (see `.agents/skills/local-infra/`) is enough to run it. CI starts minio from the same compose file and sets the variables on the test step.
