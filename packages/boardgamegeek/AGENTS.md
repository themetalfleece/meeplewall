# packages/boardgamegeek

`@board-games/boardgamegeek`: a typed BoardGameGeek client over BGG's open JSON API at `api.geekdo.com`, plus the box-size cross-check that turns a game's editions into one box in centimetres. Framework-agnostic.

The endpoints, their quirks, the rate limit, what is blocked and the box-size method are in `.agents/skills/boardgamegeek/SKILL.md`. Read it before changing anything here.

## Rules

- **Never read `process.env` in `src/`.** `createBggClient({ userAgent, requestsPerSecond })` takes both as arguments and validates them with Zod. The app reads `BGG_USER_AGENT` (see `.env.example`). `scripts/dev-fetch.ts` is a dev tool and reads it itself.
- **Every response goes through a schema in `src/schemas.ts`.** Each schema transforms the geekdo payload into the public camelCase shape, and the inferred output types are the exported types. List only the fields we use; unknown fields are stripped.
- **The transport sits behind `BggClient`.** `GeekdoClient` is the only implementation. An XMLAPI2 transport would be a second class implementing the same interface, not a branch inside this one.
- **Every request goes through `PoliteHttpClient`**: the caller's `User-Agent`, the requests-per-second throttle, and backoff on 429 and 503.

## Tests

The unit tests replay real geekdo responses from `src/fixtures/`, copied from the legacy pipeline's BGG cache and wrapped back in each endpoint's envelope, through a `vi.spyOn(globalThis, 'fetch')` stub. `legacy-boxes.json` is the legacy enrichment report for the same games, and the box tests assert the port reproduces it exactly.

`client.e2e.test.ts` calls geekdo live and skips when it is unreachable.

`pnpm --filter @board-games/boardgamegeek dev-fetch <bggId>` prints a parsed game, its version count and the cross-checked box. It reads `BGG_USER_AGENT` from the root `.env.local` or the shell.
