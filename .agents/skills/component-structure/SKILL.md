---
name: component-structure
description: >-
  Where a file goes and what belongs in it, for a React codebase. Read before
  creating a component directory, adding a file to one, extracting a helper out
  of a component, or moving a hook, type, or standalone function. Covers the
  ComponentName.* file convention, inner components, grouped implementations,
  classes and their helpers, and what may never live in a .component.tsx.
---

# Component structure and file placement

## The component directory

Each component lives in its own directory. Create only the files it needs.

```
ComponentName/
  ComponentName.component.tsx   # React component
  ComponentName.module.css      # Scoped CSS module styles
  ComponentName.types.ts        # Types and interfaces (props, data shapes)
  ComponentName.constants.ts    # Constants and static data
  ComponentName.hooks.ts        # Custom hooks
  ComponentName.data.ts         # API calls, data fetching, computation
  index.ts                      # Public export barrel
```

## What must leave `.component.tsx`

Keep it focused on rendering. Each of these has a required destination:

- **Types and interfaces** go in `.types.ts`. Never define a props type inline.
- **`useEffect` hooks** go in `.hooks.ts`. Click-outside handlers, data-fetching side effects, ref syncing: all of them, never inline.
- **Standalone functions** go in `.hooks.ts` (behaviour) or `.data.ts` (computation and data fetching). Formatters, validators, parsers.
- **Large computation or data fetching** goes in `.data.ts`. Never `.spec.ts`, which is reserved for tests.
- **SVG icons** are their own components in the shared icon location. Never embed SVG markup in another component's JSX.

## Styling

- **Merge class names with `clsx`.** Never concatenate strings.
- **Never hardcode colors.** Use the CSS custom properties defined in the global stylesheet.

## Inner components

Use an inner component for a repeated or distinct UI fragment inside a component directory. `PostList/PostCard.component.tsx` renders one post's title, date and tags inside the list.

Inner components drop the parent's prefix, because the directory already conveys scope: the file is `PostCard.component.tsx` and the export is `PostCard`. Re-add the prefix only when the bare name would be too generic to read at a glance.

They live beside their parent, never in a separate top-level directory.

## Classes and their helpers

**One domain class per implementation file.** Name the file for the class. Expose related construction, parsing and query-building behaviour as class statics rather than as adjacent `build*` / `parse*` / `format*` functions.

**A file-private helper beside a class belongs on the class.** Every free function in that file that only serves the class moves onto it: a `static` when it needs no instance state, a `#private` method or getter when it reads any. This covers `read*` / `resolve*` / `describe*` / `is*`, not just the `build*` family. A genuinely reusable helper goes to a shared module instead. Never leave it as a loose sibling.

## Grouped implementations

When a feature has several implementations of the same concern (`markdown.render.ts` + `mdx.render.ts`), move the group into a subdirectory named for the concern: `render/`.

The dispatcher and the shared types for that concern belong **inside** that subdirectory alongside the implementations. Siblings that are not part of the group stay at the parent root.

Inside the subdirectory, intra-group imports are relative siblings (`./markdown.render`). Anything crossing out uses the path alias, never `../`.

## Each component lives with its narrowest owner

Pick the first that fits:

- A **primitive**, feature-agnostic and reusable (a button, a tooltip): the shared UI location (`components/ui/`, or a `packages/ui` workspace in a monorepo).
- A **feature component**, owned by one feature: inside that feature's directory.
- An **app-only component**, used by the app shell and nothing else (a footer, a JSON-LD block): the app's own `components/`.

The app's `components/` is not a staging area. Once a second consumer needs one of its components, move it to the place it belongs rather than importing across.
