---
title: No chained ?? for multi-step selection
tags: selection, readability
---

## No chained `??` for multi-step selection

When selecting from several fallback candidates, assign each step to a named `const` and return it behind an early `if (x) return x;` guard.

A `??` chain hides both the priority order and what each step means. Named constants make each candidate self-documenting and let you put a comment on the one that needs it.

**Incorrect:**

```ts
const image = post.coverImage ?? series.coverImage ?? site.defaultImage ?? null;
```

**Correct:**

```ts
function resolveCoverImage(): Image | null {
  const ownCover = post.coverImage;
  if (ownCover) return ownCover;

  const seriesCover = series.coverImage;
  if (seriesCover) return seriesCover;

  const siteDefault = site.defaultImage;
  if (siteDefault) return siteDefault;

  return null;
}
```

A single `??` for one default is fine. It is the chain that is the problem.
