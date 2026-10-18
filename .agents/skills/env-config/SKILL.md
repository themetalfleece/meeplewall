---
name: env-config
description: >-
  How environment variables are declared, resolved and consumed. Read before
  adding an env var, before reading process.env anywhere, and before wiring a
  server-only secret. Explains why one module owns every env read, why a missing
  variable must fail loudly rather than fall back, and why .env.example is the
  contract.
---

# Environment configuration

## One module reads the environment

A single env module (for example `lib/env.ts`, or a `core/env` package in a monorepo) is the **only** code that reads `process.env`. It exports one accessor per resolved value, plus any eagerly validated constants.

Prefer lazy accessors. A missing variable then throws where a caller actually reads it, naming that variable, rather than failing every import of the module for a value that call site never wanted. Validate eagerly only the few values every page needs.

Never read `process.env.NEXT_PUBLIC_*` outside that module. `NEXT_PUBLIC_*` values are inlined at build time, so a stray read in separately built code can capture a different value than the app expects.

## Never provide a default or fallback

If a required env var is missing, fail with a clear error. A fallback turns a misconfigured deploy into a silently wrong one.

## Document every var

Add each new var to `.env.example` with a descriptive comment. That file is the contract.

**Each workspace that reads the environment owns its own `.env.example`, listing only what it reads.** There is no repo root `.env.example` or `.env.local`. `apps/web` and `apps/image-processor` list what their env module reads; a package lists only what its own scripts and test suites read. A variable two workspaces share, such as `DATABASE_URL` or `INTERNAL_REVALIDATE_SECRET`, appears in both files.

Local overrides go in `.env.local` beside that `.env.example`, which is git-ignored. Developers copy each `.env.example` they need to `.env.local` next to it. Every loader reads its own workspace directory: Next reads `apps/web` by default, `node --env-file-if-exists=.env.local` runs from the package directory, and each `vitest.config.ts` passes its own directory to `loadEnv`.

## Server-only variables

A secret never appears in a `NEXT_PUBLIC_` name and never reaches a client component. Read it only from server code: route handlers, server components, server actions.

Never paste an env value into a comment, doc, log, test fixture or issue comment.
