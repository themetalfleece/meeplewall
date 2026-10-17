---
title: Import boundaries
tags: imports, structure
---

## No parent-relative imports two or more levels up

Never import from `../../` or deeper. Deep relative paths break the moment a file moves and they let internal helpers leak out of a package's public exports.

| Reaching                         | Use                                       |
| -------------------------------- | ----------------------------------------- |
| Across directories inside an app | the app's path alias, such as `@/lib/...` |
| Another workspace package        | the package name, `@<scope>/<package>`    |
| A sibling file                   | `./foo`                                   |
| A sibling component one level up | `../foo`                                  |

Both relative forms are allowed. One-level parent-relative is how an inner component reaches a sibling inner component inside the same parent directory, for example `PostList/PostCard/PostMeta.component.tsx` importing `../TagChip`. That keeps internal helpers out of a package's public `exports` map.

Where the repo has eslint, `no-restricted-imports` enforces this.

**Incorrect:**

```ts
import { formatDate } from "../../lib/dates";
```

**Correct:**

```ts
import { formatDate } from "@/lib/dates";
```

## Grouped implementations

Inside a subdirectory that groups several implementations of one concern, intra-group imports are relative siblings (`./markdown.render`). Anything crossing out of the group uses the alias, never `../`.
