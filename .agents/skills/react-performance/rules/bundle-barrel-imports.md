---
title: Import directly, not through a barrel
impact: CRITICAL
tags: bundle, imports
---

## Avoid barrel file imports

A barrel re-exports a whole directory. Importing one symbol from it can pull the entire directory into the bundle, because the bundler cannot always prove the rest is unused.

A UI package should expose named subpaths so consumers never have to go through the root barrel.

**Incorrect:**

```ts
import { Button, Card } from "@scope/ui";
```

**Correct:**

```ts
import { Button } from "@scope/ui/Button";
import { Card } from "@scope/ui/Card";
```

The same applies to feature directories. Import the module, not the index, when the index aggregates unrelated things.

One exception: a barrel that exists to define a package's **public exports** is doing its job. Internal modules must not route around it.
