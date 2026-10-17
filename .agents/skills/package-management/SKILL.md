---
name: package-management
description: >-
  Dependency rules. Read before adding, moving or upgrading any dependency,
  package, base image or CI action. Covers why a new dependency is pinned to
  its latest stable release, how pnpm catalogs keep one version per library,
  why context-bearing libraries are peer deps in workspace packages, overrides,
  inject-workspace-packages, and when to take an underlying library instead.
---

# Package management

## New dependencies start on the latest stable release

When you add a package, library, framework, base image, runtime version or CI action, pin it to the **latest stable release** at the time of the change. Never pick an older version by default, and never a pre-release unless the task asks for one.

1. Look the version up from the canonical source (`npm view <pkg> version`, the registry page, the project's releases). Do not guess it.
2. Pin it using the repo's existing convention (catalog, exact, caret).
3. Install, regenerate the lockfile and run the gate.
4. If the latest version breaks something you cannot fix in the same task, do not silently downgrade. Fix it, open a follow-up, or block and ask. An approved exception is written into this skill or the repo's `AGENTS.md` so it is not argued again.

This governs additions. Bumping an existing dependency is its own task.

## pnpm workspaces

### Catalogs

**Third-party versions live in `pnpm-workspace.yaml`, never in a manifest.** Every non-`workspace:*` entry in a `package.json` is a bare `catalog:` reference, so the range sits in exactly one place and two manifests cannot disagree about a library.

Split catalogs by what the version **means**:

| Catalog          | Holds                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `catalog:`       | Everything that can reach production, at the concrete version we build and test against             |
| `catalog:pinned` | Ships too, but exact because another dependency already resolves it at that version                 |
| `catalog:dev`    | Build and test tooling that never ships                                                             |
| `catalog:peers`  | The deliberately wider range a workspace package accepts from its host, for `peerDependencies` only |

A package that ships **and** is a workspace's test copy (`react`, `next`) stays in the default catalog and is referenced as `catalog:` from both fields. A second `dev` entry would mean two ranges for one library.

```bash
pnpm add --save-catalog <pkg>                               # ships
pnpm add -D --save-catalog-name=dev <pkg>                   # tooling
pnpm add --save-catalog-name=pinned <pkg>@<exact version>   # matches another dependency's copy
```

**The flag has to be passed every time.** `saveCatalog` in `pnpm-workspace.yaml` and `save-catalog` in `.npmrc` are both silently ignored. Without the flag the version lands in the manifest.

### Context-bearing libraries are peer deps

Libraries that rely on React Context identity (`react`, `react-dom`, `next`, `@tanstack/react-query`) are `peerDependencies` in every shared workspace package. The app is the **only** place they appear in `dependencies`. A package may also list one in `devDependencies` for its own tests.

A second copy in a workspace package's `dependencies` gives a second Context identity, and hooks break at runtime.

### `inject-workspace-packages=true`

Without it, a workspace dependency resolves its own `node_modules` and picks up its devDep copy of a context-bearing library. With it, every workspace dep is hardlinked into the consumer's virtual store, so peers resolve through the host app.

**Injection copies rather than symlinks.** After editing a workspace package's source, re-run `pnpm install` or the consuming dev server keeps serving the stale copy.

### Pin drifting transitive copies with `overrides`

When a transitive dependency resolves a second copy of a library you depend on directly, add an `overrides` entry in `pnpm-workspace.yaml`, with the same range as the catalog entry. Verify with `pnpm why -r <lib>`: one resolved version means it took.

## Taking the underlying library instead

When you need a primitive that a large SDK happens to bundle, depend on the library that primitive comes from rather than the SDK. Put it in `catalog:pinned` at the exact version the SDK resolves, read off that SDK, so the two never drift onto separate copies.
