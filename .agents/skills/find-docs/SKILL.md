---
name: find-docs
description: >-
  How to look up current documentation for a library, framework, SDK or CLI. Read
  before answering an API-syntax, configuration or migration question from
  memory, and before guessing at a signature. Training data goes stale on API
  details. Check the installed copy first and fall back to Context7 for
  packages that ship no docs.
---

# Finding documentation

Forked from the Context7 `find-docs` skill (see `.agents/skill-lock.json`), with local-first precedence added.

## Precedence: the installed copy wins

**Check `node_modules/<package>/` first.** Many packages ship their documentation inside the tarball, and Next is the case that matters most: `node_modules/next/dist/docs/` is the documentation for the **exact version installed**.

That beats any published or remembered source, because a published doc site describes the latest release and the repo may not be on it. See `.agents/skills/nextjs/SKILL.md`.

So the order is:

1. `node_modules/<package>/` for bundled docs, and the package's own `.d.ts` files for signatures.
2. Context7, for a package that ships no usable docs.
3. Your own knowledge, only after saying that is what you are relying on.

**Never assert an SDK capability from documentation alone.** An advertised feature can be a stub. When the claim matters, grep the published bundle in `node_modules` and confirm the implementation exists.

## Context7

Two steps: resolve a library name to an id, then query docs with that id.

```bash
npx ctx7@latest library <name> "<query>"
npx ctx7@latest docs <libraryId> "<query>"
```

Run through `npx ctx7@latest` so no global install is needed.

You must call `library` first to obtain a valid id, unless you already have one in the form `/org/project` or `/org/project/version`.

**Cap: three calls per question.** If you have not found it after three, use the best result you have.

### Resolving

```bash
npx ctx7@latest library React "How to clean up useEffect with async operations"
npx ctx7@latest library "Next.js" "How to set up app router with middleware"
```

Use the official name with its punctuation: "Next.js" not "nextjs", "Three.js" not "threejs". If results look wrong, try an alternate spelling before changing the query.

Always pass a query. It is required and it ranks the results.

Each result carries a library id, name, description, code-snippet count, source reputation and benchmark score. Prefer exact name matches, high snippet counts and high reputation. If several match well, say so and proceed with the most relevant.

Version-specific ids exist where the library indexes them: `/vercel/next.js/v14.3.0-canary.87`. Use one when the question is version-specific, and take the closest match from the `library` output.

### Querying

```bash
npx ctx7@latest docs /facebook/react "How to clean up useEffect with async operations"
```

One topic per query. Split "routing and auth and caching" into separate calls unless the question is about how they interact.

Be specific. `"React useEffect cleanup function with async operations"` returns something useful; `"hooks"` does not.

Describe what to look up in the library's documentation, not the task you are completing.

**Never put sensitive information in a query.** No API keys, credentials, personal data or proprietary code.

## Failures

On a quota error, say the quota is exhausted and that you are answering from training knowledge, which may be outdated. Suggest `npx ctx7@latest login` for higher limits.

**Never silently fall back to training data.** Always say why the lookup did not happen.

Under a sandbox, a DNS or network failure (`ENOTFOUND`, host resolution failure, `fetch failed`) means the call needs to run outside the sandbox rather than be retried inside it.

## Common mistakes

- Library ids need the leading `/`: `/facebook/react`, not `facebook/react`.
- `docs` without a resolved id fails. Run `library` first.
- Single-word queries return generic results.
- Skipping step 1 of the precedence list. The installed copy is usually right there.
