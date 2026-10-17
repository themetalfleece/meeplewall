---
name: workspace-packages
description: >-
  How a workspace package in this pnpm monorepo is wired. Read before creating
  a package under apps/ or packages/, before editing a package's tsconfig,
  ESLint or Prettier config or its scripts, and before changing CI. Covers the
  shared config package, why typecheck is tsc --noEmit, how CI picks up each
  package's scripts with --if-present, and the app-layer import boundary.
---

# Workspace packages

## Layout

- `apps/*`: deployable apps. `apps/web-legacy` is frozen; its own `AGENTS.md` says what may change there.
- `packages/*`: shared code. `packages/config` (`@board-games/config`) is the shared TypeScript, ESLint and Prettier config.
- Root-level `scripts/` holds repo tooling (the agent doc scripts), not app code.

## Wiring a new package

1. `tsconfig.json` extends `@board-games/config/tsconfig.base.json`. The base turns on `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` and `exactOptionalPropertyTypes`. Do not relax them in the package.
2. `eslint.config.js` re-exports the shared config:

   ```js
   export { default } from '@board-games/config/eslint';
   ```

   That config makes `no-explicit-any`, the `no-unsafe-*` family and `consistent-type-assertions: never` errors. Fix the types instead of disabling a rule.

3. Prettier re-exports `@board-games/config/prettier`, the same way as the root `prettier.config.mjs`.
4. Name the scripts `lint`, `typecheck`, `build` and `test`. The test script is `vitest run`; the root `vitest.config.mts` lists every non-legacy workspace as a Vitest project, so `pnpm exec vitest` at the root runs them all. The typecheck script is `tsc --noEmit`. The base emits declarations and source maps on purpose, so a package that builds with `tsc` gets output; emit is switched off per invocation, never in the base.
5. Add `@board-games/config` as a `workspace:*` dev dependency.

## Import boundary

`packages/*` never imports from `next` or `react-dom/server`. A shared package that needs one of them is really app code: move the code into the app, or take the value as a parameter.

## External data

Anything from outside the type system (an API response, a file, a database row, `JSON.parse`) goes through a Zod or Valibot schema at the boundary. Consume the schema's inferred type downstream. A cast would hide exactly the shape mismatch the schema exists to catch.

## CI

`.github/workflows/ci.yml` runs, in order: `pnpm install --frozen-lockfile`, `pnpm format` (Prettier check), then `pnpm -r --if-present lint`, `typecheck`, `build` and `test`, and finally builds each app image under `infra/`. The root `pnpm test` runs the same `test` recursion locally.

`--if-present` means a package joins a gate only once it defines that script, so a new package does not need stubs. The flip side: a package with no `typecheck` script is silently unchecked. Every new package defines `lint`, `typecheck` and `build`, and adds `test` with its first test.

`.github/workflows/deploy.yml` builds `web-legacy` and publishes `apps/web-legacy/dist` to GitHub Pages.

## Prettier scope

`.prettierignore` leaves out the frozen legacy app, generated output, the original root planning docs (`/*.md` except `AGENTS.md`) and the shared agent baseline, which is formatted in its source repo and copied byte-identical. Everything else is in the gate, so run `pnpm format:write` before handing work over.

Prettier rewrites a `\uXXXX` escape in a string literal into the literal character. To keep a forbidden character such as an em dash out of the source, build it with `String.fromCodePoint(0x2014)` instead.

## Versions

New dependencies follow `package-management`. Every third-party entry outside the frozen `apps/web-legacy` is a `catalog:` reference into `pnpm-workspace.yaml`. The shared lint and format tooling is in `catalog:dev` even though `packages/config` lists it under `dependencies`, because none of it ships.

To give a package a library the catalog already lists, write the `catalog:` reference into its `package.json` by hand and run `pnpm install`. `pnpm add --save-catalog-name=dev eslint` re-resolves the newest release and rewrites the existing catalog range for every package (it moved `typescript` across a major), which is an upgrade, not an addition.

Vitest's `vite` peer binds to whatever copy the workspace already has, which is the legacy app's Vite 5. That is why the root depends on `vite` from `catalog:dev`. Run `pnpm peers check` after adding any tool with a `vite` peer.

`injectWorkspacePackages: true` is set in `pnpm-workspace.yaml`. Changing a setting that alters the `node_modules` layout makes `pnpm install` purge `node_modules`, and without a TTY it aborts with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. Run `pnpm install --config.confirmModulesPurge=false` once.
