---
name: testing
description: >-
  Test conventions, what must be covered, and the rules for networked e2e
  suites. Read before writing or changing a test, before adding an exported
  function that needs coverage, before touching an e2e suite, and before any
  browser test, smoke check or screenshot. Explains why a
  regression test must be seen to fail, why an e2e must never pass by doing
  nothing, and why fixtures come from the source of truth rather than literals.
---

# Testing

The default framework is Vitest, configured in `vitest.config.mts`. A repo with no `package.json` uses the built-in `node:test` runner instead, with `node --test`.

## What must be covered

All utility functions, helpers, data-fetching logic and pure hooks need thorough unit tests. Every exported function in `lib/**/*.ts`, `.data.ts` and `.hooks.ts` files must be covered.

Tests live next to the file they cover with a `.test.ts` suffix: `slug.ts` becomes `slug.test.ts`, `PostList.hooks.ts` becomes `PostList.hooks.test.ts`.

`.spec.ts` is reserved for tests. Never use it as a home for computation you moved out of a component.

## Structure

Use `describe` blocks grouped by function or class, with `it` descriptions that state the expected behaviour.

Mock external dependencies (`fetch`, env vars) with `vi.spyOn` or `vi.mock`, and always restore mocks in `afterEach`.

**Edge cases are mandatory.** Zero and empty inputs, missing data, error paths, boundary conditions. Not just the happy path.

## Proving a regression test works

A regression test that never went red proves nothing. Flip the fix off and confirm the test fails, then restore it.

Pair every stop-assertion with a keeps-going control, so the test distinguishes "the guard fired" from "nothing ran at all".

## Networked e2e suites

An e2e suite holds **only** assertions that need the network. Anything assertable without it belongs in a plain `.test.ts`, where it runs on every change.

**Fixtures come from the source of truth, never literals.** Resolve ids, URLs and config values from the same registry the app reads, so a config change that would break the app fails the suite instead of leaving it green against stale values.

**An e2e must never pass by doing nothing.** A missing prerequisite (an unset credential, an unreachable service) uses `it.skip` so it reports as skipped. Never `return` early from a test body: the runner counts that as a pass.

## Browsers

**Use Google Chrome for every browser test, smoke test, screenshot and manual check. Never Microsoft Edge**, even though it is the Windows default.

- Chrome MCP: use the Chrome extension.
- Playwright: launch with `channel: "chrome"` or the bundled Chromium. Never `channel: "msedge"`.
- If Chrome is unavailable, stop and report it. Do not fall back to Edge.
- A headless `--screenshot` window is at least about 500 pixels wide, whatever `--window-size` asks for, and a lone image is centred in it. Size the window to the content or the shot clips it.

## The gate

The commands are listed once, under "Before you finish" in the root `AGENTS.md`. Every one must pass before a handoff.
