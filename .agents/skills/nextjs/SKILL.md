---
name: nextjs
description: >-
  Next.js changes faster than training data, so the installed version likely
  has breaking changes against what you remember. Read before writing any
  Next.js code: App Router files, route handlers, server components, caching,
  metadata, OG images, client data fetching, or config. Says where the docs for
  the exact installed version live and lists the traps that break builds.
---

# Next.js

## This is not the Next.js you know

The installed version may have breaking changes. APIs, conventions and file structure may all differ from your training data.

**Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.** Those are the docs for the exact version installed, which is what makes them better than anything published or remembered. Heed deprecation notices.

For libraries that ship no docs inside their package, see `.agents/skills/find-docs/SKILL.md`.

## Traps that break builds

**Never statically import `react-dom/server` in a React Server Component.** It fails the build. OG and social-image code must use a dynamic import.

**An OG image generator imports heavy server reads inside the function**, not at module scope. A top-level import puts those reads in the module graph of every OG route.

**A throw inside `use cache` fails build-time prerendering.** Swallow build-time errors _inside_ the cached function. A caller-side `try`/`catch` runs too late, because the throw happens while the cache entry is being produced.

**Set `crossOrigin: "anonymous"` in `next.config.ts` when chunks are served from a CDN.** Without it, an error thrown inside a CDN-served chunk reaches `window.onerror` as an opaque `"Script error."` with no stack.

## Metadata

**`export const alt` on an image route is one string for every param.** An alt that reads the route params needs `generateImageMetadata({ params })`, which moves the image to `.../opengraph-image-<hash>/<id>` and cannot share a file with `generateStaticParams`: with both exported, the page's `og:image` tag points at the suffixed URL while the image is served without it, and the tag's URL 404s.

In the root `app/layout.tsx`, always set `metadataBase` from the site URL env var, with no fallback. Social metadata resolution depends on it.

## Server components and reads

Never self-fetch the app's own `/api/...` URL from a Server Component. Call the server read helper directly and pass the result as client initial data.

Put that async component beneath a focused Suspense boundary so a cold upstream or cache miss streams fallback UI rather than delaying the page shell.

Long-running waits stay on the client as polling. Do not hold a server request open waiting on an external job; expose a single-shot status read and let the client poll it.

## Client data fetching

Use `@tanstack/react-query` (`useQuery`) for all client-side data fetching. Never hand-roll `useEffect` plus `setInterval`.

Always thread `signal` from `queryFn` into the fetch: `queryFn: ({ signal }) => fetcher(query, { signal })`. That is what frees the connection when a query is superseded or unmounted.
