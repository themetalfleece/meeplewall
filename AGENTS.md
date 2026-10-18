# Meeplewall

Meeplewall: board game collections from BoardGameGeek, rendered as 3D boxes, at meeplewall.com. Prose says Meeplewall; identifiers, package names and slugs say `meeplewall`. pnpm workspaces monorepo (`apps/*`, `packages/*`). `packages/config` holds the shared TypeScript, ESLint and Prettier config.

This file is always loaded, so it stays small. Long-form rules live in `.agents/skills/`: read one **only when you touch its area**, and before you edit. A workspace with rules of its own has a nested `AGENTS.md`.

## Read before you touch

| Working on                                            | Read                                          |
| ----------------------------------------------------- | --------------------------------------------- |
| Adding or configuring a workspace package, CI         | `.agents/skills/workspace-packages/SKILL.md`  |
| Postgres, minio, `docker-compose.yml`, Dockerfiles    | `.agents/skills/local-infra/SKILL.md`         |
| Game data, BGG, covers, textures, the 3D box, porting | `.agents/skills/planning-docs/SKILL.md`       |
| Renderer lighting, shaders, package shapes            | `.agents/skills/renderer/SKILL.md`            |
| BoardGameGeek API, rate limit, box-size cross-check   | `.agents/skills/boardgamegeek/SKILL.md`       |
| Comments, docs, any prose                             | `.agents/skills/writing-style/SKILL.md`       |
| Any TypeScript                                        | `.agents/skills/typescript-style/SKILL.md`    |
| A component directory or file layout                  | `.agents/skills/component-structure/SKILL.md` |
| Anything Next.js                                      | `.agents/skills/nextjs/SKILL.md`              |
| Rendering, memoisation, bundle size                   | `.agents/skills/react-performance/SKILL.md`   |
| A library API you are unsure of                       | `.agents/skills/find-docs/SKILL.md`           |
| Tests, browser checks, screenshots                    | `.agents/skills/testing/SKILL.md`             |
| PWA: service worker, manifest, offline, install       | `.agents/skills/pwa/SKILL.md`                 |
| Adding or upgrading a dependency                      | `.agents/skills/package-management/SKILL.md`  |
| Environment variables, secrets                        | `.agents/skills/env-config/SKILL.md`          |

Operating as an agent rather than writing code: `.agents/skills/agent-task-workflow/`, `.agents/skills/agent-code-review/`, `.agents/skills/agent-review-loop/`, `.agents/skills/agent-git-policy/`, `.agents/skills/agent-paperclip/`. Role definitions are in `.agents/roles/`. How this tree works: `.agents/README.md`.

## Rules that always apply

These hold everywhere and are checkable from a diff alone.

- **Write the way you would explain it out loud.** Cut filler, hedging and throat-clearing.
- **No em dashes anywhere**: prose, comments, docs, strings, identifiers. Use a comma, a colon, parentheses or a second sentence.
- **Keep comments to what and why.** One line is usually enough. No framework explainers, no history ("this used to X"), no restating the code.
- **Keep docs concise.** Lead with the rule, skip the preamble, do not restate what the reader just read.
- **Never put issue IDs in the repo.** No `ABC-123` in code, comments, strings, tests, fixtures, config or docs. Describe the change, not the ticket.
- **Never touch the git state.** Agents edit files only: no staging, unstaging, commits or pushes, and no GitHub writes. See `agent-git-policy`.
- **Always `pnpm`, never `npm` or `yarn`.** The version is pinned by `packageManager` in the root `package.json`.
- **No `any` and no `as` casts.** Both are lint errors. Parse unknown or external data with a schema (Zod or Valibot) at the boundary and use its inferred type.
- **`packages/*` never imports `next` or `react-dom/server`.** Those belong to the app layer.
- **Every workspace extends the shared config**: `tsconfig.json` extends `packages/config/tsconfig.base.json`, and the ESLint and Prettier configs re-export `@meeplewall/config/eslint` and `@meeplewall/config/prettier`.
- **Pin every container image to an exact tag.** Never `:latest` or another floating tag.
- **Never use nested ternaries or `switch`.** Extract a function with `if`/`return`; close a dispatch with a `never` tail.
- **No `../../` imports, no conditional object spread, no inline functions in JSX, no chained `??`.**
- **Use full variable names**, callback parameters included. No underscore-prefixed private fields.
- **Use object params for ambiguous signatures.** Two parameters of the same type, or any boolean, means one options object.
- **Pin a new dependency to its latest stable release.**
- **Docs follow the code.** Renaming, removing or re-scoping something updates every doc naming it in that change. Grep the old name.

## Write down what you learn

**Anything you learn that is not already written here goes back into these files, in the same change that taught you it.** A correction from the board, a convention you were told, a gotcha that cost an hour. If a rule changes, edit it instead of appending a contradiction.

Put it in the skill or nested `AGENTS.md` that owns the area. Put it here only if it holds everywhere **and** a reviewer could catch it from a diff with no context. The validator enforces this file's budget, so if it no longer fits, the rule belongs in a skill.

## Before you finish

All must pass, in this order, as CI runs them. Formatting is a real gate:

```bash
pnpm format:write && pnpm format
pnpm build          # first: lint and typecheck read workspace packages' types from dist/
pnpm lint
pnpm typecheck
pnpm test
pnpm validate       # agent docs and links
pnpm test:scripts   # tests for the agent doc scripts
```

Never lint before building: a missing `dist/` fails, and a stale one checks against old types. The last two need Node 24.2 or newer. `pnpm agents:link` repairs the symlinks; on Windows, rerun it after a checkout.
