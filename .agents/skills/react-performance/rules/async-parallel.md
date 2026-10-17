---
title: Promise.all for independent operations
impact: CRITICAL
tags: waterfalls, async
---

## Use `Promise.all()` for independent operations

Two awaits in sequence cost the sum of their latencies. If neither depends on the other, that sum is pure waste.

**Incorrect:**

```ts
const post = await getPost(slug);
const tags = await getTags();
```

**Correct:**

```ts
const [post, tags] = await Promise.all([getPost(slug), getTags()]);
```

For a fan-out over many sources, apply a per-source deadline and return partial results rather than waiting out the slowest one.

Where two reads are always requested together, merge them into one call or route instead.
