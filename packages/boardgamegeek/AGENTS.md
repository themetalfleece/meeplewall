# packages/boardgamegeek

`@meeplewall/boardgamegeek`: a typed BoardGameGeek client over BGG's open JSON API at `api.geekdo.com`, a client for the one XMLAPI2 endpoint we use (a user's collection), plus the box-size cross-check that turns a game's editions into one box in centimetres. Framework-agnostic.

The endpoints, their quirks, the rate limit, what is blocked and the box-size method are in `.agents/skills/boardgamegeek/SKILL.md`. Read it before changing anything here.

## Rules

- **Never read `process.env` in the library.** `createBggClient({ userAgent, requestsPerSecond })` and `createBggCollectionClient({ userAgent, token, requestsPerSecond })` take everything as arguments and validate it with Zod. The app reads `BGG_USER_AGENT` and `BGG_API_TOKEN` (see `apps/web/.env.example`). `scripts/dev-fetch.ts` and the live `*.e2e.test.ts` suites read them themselves.
- **Every response goes through a Zod schema**: geekdo's in `src/schemas.ts`, the XMLAPI2 collection's in `src/collection.ts` beside its parser. Each schema transforms the payload into the public camelCase shape, and the inferred output types are the exported types. List only the fields we use; unknown fields are stripped.
- **The transport sits behind `BggClient`.** `GeekdoClient` is the only implementation. Games stay on geekdo; XMLAPI2 serves only the collection, through `BggCollectionClient` in `src/collection.ts`.
- **Every request goes through `PoliteHttpClient`**: the caller's `User-Agent`, the requests-per-second throttle, and backoff on 429 and 503. `get` returns the raw response for callers that read XML or handle 202 themselves; `getJson` parses with a schema.

## Tests

The unit tests replay real geekdo responses from `src/fixtures/`, copied from the legacy pipeline's BGG cache and wrapped back in each endpoint's envelope, through a `vi.spyOn(globalThis, 'fetch')` stub. `legacy-boxes.json` is the legacy enrichment report for the same games, and the box tests assert the port reproduces it exactly.

`client.e2e.test.ts` calls geekdo live and skips when it is unreachable. `collection.e2e.test.ts` calls XMLAPI2 live and skips when `BGG_API_TOKEN` is unset. `collection.test.ts` replays `src/fixtures/collection.xml`.

`pnpm --filter @meeplewall/boardgamegeek dev-fetch <bggId>` prints a parsed game, its version count and the cross-checked box. It reads `BGG_USER_AGENT` from this package's `.env.local` (copy `.env.example`) or the shell.
