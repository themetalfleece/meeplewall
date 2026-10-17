---
title: Load analytics and logging after hydration
impact: CRITICAL
tags: bundle, analytics
---

## Defer non-critical third-party libraries

Instrumentation should never be on the first-render critical path. Analytics, logging and session-replay SDKs are pure overhead to the user's first paint, and they are usually large.

Import them from inside the mount effect rather than at module scope. That does two things at once: it code-splits the SDK out of the initial bundle, and it keeps the synchronous init work off first render.

**Incorrect:**

```ts
import { initTelemetry } from "@vendor/telemetry";
```

**Correct:**

```ts
const { initTelemetry } = await import("@vendor/telemetry");
```

Keep type-only imports `import type`, so the type import does not pull the runtime module back in.

## Buffer, do not gate

Deferring the SDK creates a window where the app can emit before the SDK exists. Do not push that problem onto call sites by making them check a `ready` flag, which is easy to forget and noisy everywhere.

Buffer instead: queue emissions while the SDK loads and replay them in order once it resolves. Call sites then emit unconditionally and the deferral is invisible to them. Cap the buffer so a failed load cannot grow it forever.
