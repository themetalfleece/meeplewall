# packages/worker-runtime

`@meeplewall/worker-runtime`: what every long-running worker under `apps/` shares. `JsonLogger` writes one JSON object per line to stdout, `HealthServer` serves `GET /healthz`, and `PollLoop` repeats a claim-and-process round until SIGTERM.

## Rules

- **No domain code.** Anything that knows about games, images or BGG belongs in the worker or its package.
- **Never read `process.env`.** Each worker's `src/env.ts` does that and passes values in.
- **`PollLoop.run` never rejects.** A round that throws goes to `onError` and is retried after the idle wait, so a database blip does not kill the process.
