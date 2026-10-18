---
name: pwa
description: >-
  How the web app works offline and installs. Read before touching
  apps/web/public/sw.js, its test, the manifest, the icons, the offline page,
  the install prompt or the service worker registration, and before running
  or changing the Playwright offline checks.
---

# The PWA

The manifest is `apps/web/src/app/manifest.ts`. The service worker keeps the app shell, so `/` opens offline. Collections and games need the network: offline, every other page gets `/offline`.

## The service worker

- **`public/sw.js` is hand-written plain JS**, because files in `public/` skip the build. It caches `/`, `/offline`, and every `/_next/static` bundle and same-origin image or font their HTML names. Nothing under `/u` or `/g` is ever cached.
- **A deploy refreshes the shell without a new `sw.js`.** `/` is network-first. When the bundles its HTML names change, the worker recaches both pages and drops the bundles neither uses. Bump the cache names only when the worker's own caching changes.
- **Bundles are cache-first, everything else network-first.** Bundle names carry a content hash, so a cached one never goes stale.
- **Its test is `apps/web/src/sw.test.ts`**, because everything in `public/` is served. It runs the real script in a VM sandbox with an in-memory network and cache.
- **It registers in production builds only.** In `next dev` it would serve cached bundles over fresh ones.

## Install prompt

`InstallPrompt` keeps Chrome's `beforeinstallprompt` event and shows its own button. iOS has no such event, so there it explains Share, then Add to Home Screen. A dismissal is kept in `localStorage`. The platform is read after mount, so the server render and hydration agree.

## Icons

`src/app/icon.svg` is the source. `public/icons/*.png` and `src/app/apple-icon.png` are rendered from it with `sharp`. The maskable icon and the Apple icon fill the square, since the platform crops them.

## Playwright checks

`pnpm --filter @meeplewall/web test:e2e`, after a build. It serves the standalone build and checks the manifest, installability and the worker through DevTools, then goes offline and loads `/` and `/u/foo`. It uses Playwright's bundled Chromium: run `pnpm exec playwright install chromium` once.

- **Chromium never offers to install from an incognito profile**, which every default Playwright context is. The installability check launches a persistent context.
- **Offline, the console shows failed `?_rsc=` prefetches** for the links on the page. That is expected: route data is never cached.
