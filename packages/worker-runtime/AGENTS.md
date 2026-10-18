# packages/worker-runtime

`@meeplewall/worker-runtime`: what every long-running worker under `apps/` shares. `JsonLogger` writes one JSON object per line to stdout, `HealthServer` serves `GET /healthz`, and `PollLoop` repeats a claim-and-process round until SIGTERM. `runWorkerProcess` is each worker's `main`: it loads the config, calls the worker's `start`, serves `/healthz` beside it, and on SIGTERM or SIGINT waits for the worker, then closes the health server, then what `start` opened. It logs `<name> started`, `stopped` and `crashed`, and returns the exit code.

## Rules

- **No domain code.** Anything that knows about games, images or BGG belongs in the worker or its package.
- **Never read `process.env`.** Each worker's `src/env.ts` does that and passes values in.
- **No dependency on `@meeplewall/db`.** A worker passes its pool to `logIdleConnectionErrors` and its `select 1` as `ping`, so the package stays free of domain code.
- **Library packages do not depend on this one.** `packages/collection-sync` is also imported by apps/web, which is not a worker, so it keeps its own copy of `describeError`.
- **`PollLoop.run` never rejects.** A round that throws goes to `onError` and is retried after the idle wait, so a database blip does not kill the process.
