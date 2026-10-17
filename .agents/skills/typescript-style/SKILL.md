---
name: typescript-style
description: >-
  The worked examples behind the TypeScript style rules. Read when you need to
  see what a rule looks like in practice, when a review cites one, or when you
  are about to write a branch, a fallback chain, an options object or an import
  that one of them governs. AGENTS.md states each rule in one line; the rule
  files here show the incorrect and correct forms.
---

# TypeScript style

`AGENTS.md` states each rule in one line, which is enough to follow most of the time. Open a rule file here when you want the reasoning or a worked example.

## Rules

Control flow:

- `no-nested-ternary` - extract a function with `if`/`return` instead of nesting
- `no-switch` - closed-set dispatch is an `if` chain with a `never` tail
- `exhaustive-dispatch` - which unions are in scope and how to make a new member fail compilation

Signatures and selection:

- `object-params` - two same-typed parameters, or any boolean, means one options object
- `no-chained-nullish` - name each fallback candidate and return it behind an early guard
- `no-conditional-spread` - construct the object explicitly, or drop absent keys with a helper

Structure:

- `import-boundaries` - never `../../`, and which alias to reach for
- `blank-line-grouping` - separate reading, deriving and returning

## Conventions with no example needed

These are stated in `AGENTS.md` and need no expansion:

- Full variable names. `sourceUrl`, not `srcUrl`. Callback parameters included.
- `private` or `#` for class fields, never an underscore prefix.
- TSDoc on exported functions and non-trivial helpers. Skip it for obvious one-liners.
- No issue IDs anywhere in source.

When state and the operations over it belong together, model them as a class with a small public API rather than passing a bag of parameters between free functions. Use a plain function where that reads more clearly.

## Related

- Comment and prose style: `.agents/skills/writing-style/SKILL.md`
- Where a file goes: `.agents/skills/component-structure/SKILL.md`
