---
title: Load a module only when its feature activates
impact: CRITICAL
tags: bundle, lazy
---

## Conditional module loading

When a module only matters once a feature is switched on, import it at the point of activation rather than at module scope. A static import at the top of the file ships the module to every user, including the ones who never reach the feature.

**Incorrect.** Both implementations ship to everyone, whichever one the session ends up needing.

```ts
import { renderMermaid } from "./mermaid";
import { renderMath } from "./math";
```

**Correct.** Each implementation is fetched only if a post actually needs it.

```ts
registerRenderer("mermaid", () => import("./mermaid"));
registerRenderer("math", () => import("./math"));
```

**The dynamic import must select only the implementation actually needed.** A loader that reaches for a shared barrel, or that imports both and picks one at runtime, has bought nothing: the bundler still has to include both.
