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

**Turbopack reads `new URL('...', import.meta.url)` in a workspace package as an asset import** and fails the build when the target is not a module. `serverExternalPackages` does not help, because workspace packages resolve outside `node_modules`. Build such paths with `node:path` and `fileURLToPath(import.meta.url)` instead.

**A module a client component imports must not import a server package, even for one function only server code calls.** The whole module graph lands in the browser bundle, and a package that reaches `postgres` fails the build with `Can't resolve 'fs'`, `'net'` and `'tls'`. Keep the shared contract (schemas, types) in its own module and put the server helper beside the server code.

**`next dev` writes a managed block into the app's `AGENTS.md`; we set `agentRules: false` because the block breaks our writing and git rules.** With the flag off, `next dev` removes the block instead of restoring it.

**Set `crossOrigin: "anonymous"` in `next.config.ts` when chunks are served from a CDN.** Without it, an error thrown inside a CDN-served chunk reaches `window.onerror` as an opaque `"Script error."` with no stack.

## Caching and revalidation

**`revalidateTag` and `revalidatePath` only take effect inside a request**: a route handler or a server action. They queue on the request's store, so a call from detached background work does nothing. A read that a background job changes either stays uncached (Postgres is fast enough) or is expired by a webhook route the job calls.

**`notFound()` inside a `<Suspense>` boundary answers 200.** The prerendered shell has already gone out, so the not-found UI streams in with a 200. Give such pages `robots: { index: false }` in their metadata. `permanentRedirect()` has the same problem: once the shell is out it can only emit a client-side meta refresh. A redirect that must be a real 308 goes in `proxy.ts`, which runs before rendering on the Node runtime.

## CSS and prefetching

**Without `experimental.inlineCss`, Chrome logs "preloaded but not used" warnings** for the root `not-found` page's CSS module and for every prefetched route's CSS. The app turns `inlineCss` on.

**Keep links on the default prefetch.** `<Link prefetch>` (full prefetch) still preloads the target route's CSS file, which the page never applies, so the warning returns.

**A CSS module class is `string | undefined`** under `noUncheckedIndexedAccess`. Plain elements accept that; a component prop typed `string` does not, so pass `clsx(styles.name)`.

## Metadata

**`export const alt` on an image route is one string for every param.** An alt that reads the route params needs `generateImageMetadata({ params })`, which moves the image to `.../opengraph-image-<hash>/<id>` and cannot share a file with `generateStaticParams`: with both exported, the page's `og:image` tag points at the suffixed URL while the image is served without it, and the tag's URL 404s.

In the root `app/layout.tsx`, always set `metadataBase` from the site URL env var, with no fallback. Social metadata resolution depends on it.

## Server components and reads

**Pages render on the server; the client is the fallback.** Fetch and render in Server Components, and reach for `"use client"` only for what needs the browser: event handlers, state, effects, browser APIs. Keep that boundary on the smallest leaf, so the page around it stays server-rendered HTML.

**`next/dynamic` in a Server Component does not code-split a Client Component.** Do the dynamic import inside a client component, or the code stays in the first-load bundle.

**A prerendered page reads its query in a client leaf under `Suspense`.** Reading `searchParams` on the server makes the page dynamic. `useSearchParams` in a small client component keeps it static: the fallback is the server HTML, and the leaf swaps in after hydration.

Never self-fetch the app's own `/api/...` URL from a Server Component. Call the server read helper directly and pass the result as client initial data.

Put that async component beneath a focused Suspense boundary so a cold upstream or cache miss streams fallback UI rather than delaying the page shell.

Long-running waits stay on the client as polling. Do not hold a server request open waiting on an external job; expose a single-shot status read and let the client poll it.

## Client data fetching

Use `@tanstack/react-query` (`useQuery`) for all client-side data fetching. Never hand-roll `useEffect` plus `setInterval`.

Give a query seeded with server `initialData` a `staleTime`. Without one it refetches the moment it mounts, repeating the read the server just did.

Always thread `signal` from `queryFn` into the fetch: `queryFn: ({ signal }) => fetcher(query, { signal })`. That is what frees the connection when a query is superseded or unmounted.
