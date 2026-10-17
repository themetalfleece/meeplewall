# packages/config

`@board-games/config`: the TypeScript base, ESLint config and Prettier config every workspace extends. A change here changes every package, so run the whole gate from the repo root.

## Rules

- **Never set `noEmit` in `tsconfig.base.json`.** The base enables `declaration`, `declarationMap` and `sourceMap` so a package that builds with `tsc` actually emits. With `noEmit` there, every `tsc` build becomes a no-op that still exits 0. Packages suppress emit per invocation with `tsc --noEmit`.
- **The strict flags stay on**: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`.
- **The type-safety lint rules stay errors**: `no-explicit-any`, the `no-unsafe-*` family, and `consistent-type-assertions` with `assertionStyle: 'never'`. Never downgrade them to warnings.
- **`eslint-config-prettier` stays last** in the ESLint config, so formatting rules never fight Prettier.
- **Stay framework-agnostic.** No Next.js or React rules here; an app layers those on in its own config.
- A new export goes in both `exports` and `files` in `package.json`.

How a package consumes this config: `.agents/skills/workspace-packages/`.
