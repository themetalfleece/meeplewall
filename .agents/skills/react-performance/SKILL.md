---
name: react-performance
description: >-
  React and Next.js performance rules, merged from Vercel's guidance with our
  own and with the conflicts already resolved. Read before adding a useMemo or
  useCallback, before adding an import that could grow the client bundle, before
  writing an effect, and when a render feels slow. The precedence section
  matters: under the React Compiler, several pieces of common advice are wrong.
---

# React performance

Merged from Vercel's `vercel-react-best-practices` (MIT, see `.agents/skill-lock.json`) with our own rules. Vercel's 57 rules were cut to the ones that apply to a Next.js App Router stack, and rewritten with our context.

## Precedence: where our rules win

**Under the React Compiler, memoisation is automatic.** Check whether the repo enables it (`reactCompiler` in `next.config.ts`, or the Babel plugin). Where it does, most published advice about manual memoisation predates it and is wrong:

- **Do not add `useCallback` unless you are passing the function to a child component.** React optimises non-inline functions on its own. A `useCallback` that exists to "avoid recreating the function" is noise.
- **Do not wrap a simple expression in `useMemo`.** If the result is a primitive and the computation is a comparison, a concatenation or an arithmetic step, the memo costs more than it saves.
- **Manual `memo()` wrappers are a last resort**, not a default. Reach for one only after you have measured the re-render.

For client data fetching use `@tanstack/react-query`, not SWR. Ignore any SWR-specific guidance. The data-fetching rules are in `.agents/skills/nextjs/SKILL.md`.

## Rules

Bundle size:

- `bundle-barrel-imports` - import directly, not through a barrel
- `bundle-dynamic-imports` - lazy-load heavy components
- `bundle-conditional` - load a module only when its feature activates
- `bundle-defer-third-party` - load analytics and logging after hydration

Waterfalls:

- `async-parallel` - `Promise.all` for independent operations
- `async-defer-await` - await in the branch that uses the value
- `async-suspense-boundaries` - stream around a slow read instead of blocking the shell

Server rendering:

- `server-cache-react` - deduplicate a read within one request
- `server-parallel-fetching` - compose components so fetches overlap
- `server-serialization` - minimise what crosses the RSC boundary

Re-renders:

- `rerender-derived-state-no-effect` - derive during render, never in an effect
- `rerender-functional-setstate` - use the updater form, and keep it pure
- `rerender-lazy-state-init` - pass a function to `useState` for expensive initial values
- `rerender-use-ref-transient-values` - a value the UI does not display belongs in a ref
- `rerender-move-effect-to-event` - interaction logic goes in the handler

Rendering:

- `rendering-no-inline-jsx-functions` - our rule, and the one most often broken
- `rendering-hydration` - what `suppressHydrationWarning` actually does

## Measuring

If the repo enforces a first-load JS budget, a static import that trips it is a regression to fix, not a reason to raise the budget.
