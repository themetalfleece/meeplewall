---
title: Use object params for ambiguous signatures
tags: signatures, readability
---

## Use object params for ambiguous signatures

If a function or method has two or more parameters of the same type, or any boolean parameter, wrap them in a single options object so call sites are self-documenting.

Positional arguments of the same type are silently swappable. The compiler cannot help, and the bug reaches production looking like a data problem.

**Incorrect:**

```ts
buildCanonicalUrl(siteUrl, slug, locale);
formatDate(publishedAt, true);
```

**Correct:**

```ts
buildCanonicalUrl({ siteUrl, slug, locale });
formatDate({ date: publishedAt, relative: true });
```

The boolean case matters just as much: `formatDate(publishedAt, true)` tells the reader nothing about what `true` selects.

Class constructors follow the same rule, so the call site reads `new Post({ frontmatter, body })`.
