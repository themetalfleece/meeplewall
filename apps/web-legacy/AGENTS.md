# apps/web-legacy

The pre-refactor Vite app, moved into the monorepo unmodified as a running reference during the migration. It still builds and deploys to GitHub Pages, and it is slated for deletion once the new app lands.

## Rules

- **Do not hand-edit code in `src/` or `scripts/`.** The app is the reference the new one is checked against, so it stays as it was.
- **Pipeline output is data, not code.** A data refresh with `pnpm --filter web-legacy data` may change what it writes: `src/data/games.json`, `public/covers/`, `public/textures/`, and the caches and reports under `scripts/` (such as `bgg-cache/`). The site still deploys, so the collection has to stay current.
- **Apart from pipeline output, only `package.json` and `tsconfig.json` may change**, and only for the minimal wiring needed to run inside the workspace. This file and its `CLAUDE.md` link are the one other exception.
- **It does not extend `@meeplewall/config`.** Its `tsconfig.json` stays standalone and non-strict, and it has no ESLint or Prettier config.
- **No `lint` or `typecheck` scripts, on purpose.** It never had them, and CI's `--if-present` gates skip a package without the script. Do not add stubs.
- **It is outside the Prettier gate** (`.prettierignore`), so never reformat it.
- Run its commands through pnpm from the repo root: `pnpm --filter web-legacy dev`, `build`, `data`. The `npm` commands in `scripts/README.md` predate the workspace.

The design and pipeline docs for this app are mapped in `.agents/skills/planning-docs/`.
