---
title: Compose components so fetches overlap
impact: HIGH
tags: rsc, waterfalls
---

## Parallel data fetching with component composition

Nesting an async component inside another async component serialises their fetches: the child cannot start until the parent resolves.

Render them as siblings, each behind its own Suspense boundary, and both fetches start together.

When a child genuinely needs a value from the parent, pass the **promise** down and let the child await it, rather than awaiting in the parent and passing the value.
