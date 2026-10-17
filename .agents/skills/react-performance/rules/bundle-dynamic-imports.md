---
title: Lazy-load heavy components
impact: CRITICAL
tags: bundle, lazy
---

## Dynamic imports for heavy components

A component the first screen does not render should not be in the first-load bundle.

**Incorrect:**

```tsx
import { ImageLightbox } from "./ImageLightbox";
```

**Correct:**

```tsx
const ImageLightbox = lazy(() => import("./ImageLightbox"));
```

## Keep the dependency out of every path that reaches it

Making one component lazy achieves nothing if a static import elsewhere pulls the same dependency into the initial chunk. Once something is lazy, every route into it has to stay lazy: the module that mounts it, and any barrel a first-load consumer imports.

That is the failure mode to watch for in review. A lazy component plus one static import of the same library is the same bundle as before, with more indirection.
