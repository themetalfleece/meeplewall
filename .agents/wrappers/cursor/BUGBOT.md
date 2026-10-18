# Bugbot review rules

Reviewing a PR in this repo. The full engineering rules are in `AGENTS.md` at the repo root, with the long-form rules in `.agents/skills/`.

The rules below are the ones checkable from a diff alone, which is what a PR review sees. Flag a violation with the rule name and the line.

## Correctness first

Report bugs, security holes, data-loss risks and broken behaviour ahead of anything stylistic.

A finding must name the concrete case where it bites: a plausible input, a real call site, a reachable state. Defensive handling for unreachable states and hypothetical future requirements are not findings. Style matching the surrounding code is correct by definition.

## Rules a diff can violate

- **No em dashes.** Not in prose, comments, strings or identifiers. An en dash or a spaced hyphen standing in for one counts too.
- **No nested ternaries.** One is fine; nesting one inside another is not. Extract a function with `if`/`return`.
- **No `switch`.** Closed-set dispatch is one `if` per member in source order, then a `never` tail so a new member fails compilation. A `default` that throws is not a substitute.
- **No parent-relative imports two or more levels up.** Never `../../`. Use the repo's path alias or package name. `./foo` and `../foo` are fine.
- **No conditional object spread.** `...(cond ? { key: value } : {})` is a violation. Set the field inline or build the object with a helper that drops `undefined`.
- **No inline functions in JSX.** `onChange={(event) => ...}` is a violation; the handler belongs in the component body or the `.hooks.ts` file.
- **No chained `??` for multi-step selection.** Name each candidate and return it behind an early guard.
- **Full variable names.** No `src`, `dst`, `btn`, or single-letter callback parameters. `(post) =>`, not `(p) =>`.
- **No underscore-prefixed private fields.** Use `private` or `#`.
- **Object params for ambiguous signatures.** Two parameters of the same type, or any boolean parameter, means one options object.
- **No issue IDs in code.** Any tracker key of the form `ABC-123` in a comment, identifier, string literal, test name or fixture is a violation. Branch names are the one exception.
- **Comments say what and why.** Flag a comment that restates the code, explains how a framework works, or narrates history ("this used to X", "migrated from Y").
- **Docs follow the code.** A diff that renames, moves or removes an export, file, config field or script, or changes what it does, while a markdown file in the tree (`AGENTS.md`, `.agents/**`, a README, `docs/**`) still names or describes the old shape, is a violation. Search the repository for each identifier the diff removes.

## Tests

New and changed behaviour needs coverage, and the test has to exercise the behaviour rather than just call the function. Edge cases are mandatory: zero and empty inputs, missing data, error paths.

A test that returns early from its body instead of using `it.skip` passes while doing nothing. Flag it.

Browser automation uses Chrome. A Playwright `channel: "msedge"` (or any Edge launch) is a violation; `channel: "chrome"` and the bundled Chromium are fine.

## This repo

- **`pnpm` only.** An `npm` or `yarn` command, or a `package-lock.json` or `yarn.lock`, is a violation.
- **No `any` and no `as` casts.** External data is parsed with Zod or Valibot at the boundary, never cast.
- **`packages/*` never imports `next` or `react-dom/server`.**
- **A workspace's `tsconfig.json` (except `apps/web-legacy`) extends `packages/config/tsconfig.base.json`**, and its ESLint and Prettier configs re-export `@meeplewall/config`. A new package also defines `lint`, `typecheck` and `build` scripts, or CI silently skips it.
- **`noEmit` never goes in `packages/config/tsconfig.base.json`.** Typecheck scripts pass `--noEmit` instead.
- **Container images are pinned to an exact tag.** `:latest` or a bare major such as `postgres:17` is a violation.
- **Code in `apps/web-legacy/src/` and `apps/web-legacy/scripts/` is frozen.** A hand edit to a source file there is a violation. Output of the `data` pipeline (`src/data/games.json`, `public/covers/`, `public/textures/`, caches and reports under `scripts/`) is data and may change.
