---
title: Deduplicate a read within one request
impact: HIGH
tags: rsc, caching
---

## Per-request deduplication

When several components in one render tree need the same read, wrap it so the work happens once per request rather than once per caller. React's `cache()` does this for a server read; Next's `use cache` adds a cache window across requests on top.

Prefer merging reads into one route over adding another per-item GET fired in the same burst. Browsers open about six concurrent connections per origin over HTTP/1.1, and a burst of per-item GETs spends them on overhead.
