/* global self */
// Keeps the app shell (the home page, the offline page, and the bundles, fonts and images they load)
// so the home page opens offline. Collection and game pages are never cached: offline, every page
// but the home page gets the offline page. Tested by src/sw.test.ts.

const PAGE_CACHE = 'meeplewall-pages-v1';
const ASSET_CACHE = 'meeplewall-assets-v1';
const HOME_PATH = '/';
const OFFLINE_PATH = '/offline';
const SHELL_PAGE_PATHS = [HOME_PATH, OFFLINE_PATH];
const BUNDLE_PATH_PREFIX = '/_next/static/';

// Bundle URLs appear in attributes and, escaped, inside the inline RSC payload.
const BUNDLE_URL_PATTERN = /\/_next\/static\/[^"'\s\\)]+/g;
const PUBLIC_FILE_URL_PATTERN =
  /(?:src|href)="(\/[^"#]+?\.(?:svg|png|ico|webmanifest|woff2?)(?:\?[^"]*)?)"/g;

function absoluteUrl(path) {
  return new self.URL(path, self.location.origin).href;
}

/** Every same-origin bundle, font and image a shell page's HTML loads, as absolute URLs. */
function shellAssetUrls(html) {
  const paths = [...(html.match(BUNDLE_URL_PATTERN) ?? [])];
  for (const match of html.matchAll(PUBLIC_FILE_URL_PATTERN)) {
    paths.push(match[1].replaceAll('&amp;', '&'));
  }

  return new Set(paths.map(absoluteUrl));
}

function haveSameMembers(first, second) {
  return first.size === second.size && [...first].every((url) => second.has(url));
}

/** Fetches both shell pages, caches what they load, then the pages, and drops assets neither uses. */
async function cacheShell() {
  const responses = await Promise.all(
    SHELL_PAGE_PATHS.map((path) => self.fetch(absoluteUrl(path), { cache: 'reload' })),
  );
  const failedIndex = responses.findIndex((response) => !response.ok);
  if (failedIndex !== -1) {
    const status = responses[failedIndex].status;
    throw new Error(
      `Could not cache the app shell: ${SHELL_PAGE_PATHS[failedIndex]} answered ${status}`,
    );
  }

  const pages = await Promise.all(responses.map((response) => response.clone().text()));
  const assetUrls = new Set(pages.flatMap((html) => [...shellAssetUrls(html)]));

  const assetCache = await self.caches.open(ASSET_CACHE);
  const cachedRequests = await assetCache.keys();
  const cachedUrls = new Set(cachedRequests.map((request) => request.url));
  await assetCache.addAll([...assetUrls].filter((url) => !cachedUrls.has(url)));
  await Promise.all(
    cachedRequests
      .filter((request) => !assetUrls.has(request.url))
      .map((request) => assetCache.delete(request)),
  );

  const pageCache = await self.caches.open(PAGE_CACHE);
  await Promise.all(
    SHELL_PAGE_PATHS.map((path, index) => pageCache.put(absoluteUrl(path), responses[index])),
  );
}

/** Stores a fresh home page, and recaches the whole shell when a deploy changed what it loads. */
async function refreshShell(homeResponse) {
  const pageCache = await self.caches.open(PAGE_CACHE);
  const cachedHome = await pageCache.match(absoluteUrl(HOME_PATH));
  const freshAssets = shellAssetUrls(await homeResponse.clone().text());
  if (cachedHome !== undefined) {
    const cachedAssets = shellAssetUrls(await cachedHome.text());
    if (haveSameMembers(cachedAssets, freshAssets)) {
      await pageCache.put(absoluteUrl(HOME_PATH), homeResponse);
      return;
    }
  }

  await cacheShell();
}

async function cachedPage(path) {
  const pageCache = await self.caches.open(PAGE_CACHE);

  return pageCache.match(absoluteUrl(path));
}

/** The offline page, or a network error when even that is not cached yet. */
async function offlineResponse() {
  const offlinePage = await cachedPage(OFFLINE_PATH);

  return offlinePage ?? self.Response.error();
}

/** The home page from the network, kept fresh in the cache, or the cached copy when offline. */
async function navigateHome(event) {
  try {
    const response = await self.fetch(event.request);
    if (response.ok) {
      event.waitUntil(refreshShell(response.clone()));
    }

    return response;
  } catch {
    const home = await cachedPage(HOME_PATH);
    if (home !== undefined) {
      return home;
    }

    return offlineResponse();
  }
}

/** Any other page goes to the network and is never cached. */
async function navigateElsewhere(request) {
  try {
    return await self.fetch(request);
  } catch {
    return offlineResponse();
  }
}

/** Bundles have content-hashed names, so a cached copy never goes stale. */
async function bundle(request) {
  const assetCache = await self.caches.open(ASSET_CACHE);
  const cached = await assetCache.match(request);
  if (cached !== undefined) {
    return cached;
  }

  const response = await self.fetch(request);
  if (response.ok) {
    await assetCache.put(request, response.clone());
  }

  return response;
}

/** Other requests use the network. Offline, a shell image or the manifest comes from the cache. */
async function networkThenShellAsset(request) {
  try {
    return await self.fetch(request);
  } catch (error) {
    const assetCache = await self.caches.open(ASSET_CACHE);
    const cached = await assetCache.match(request);
    if (cached === undefined) {
      throw error;
    }

    return cached;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('meeplewall-'))
            .filter((name) => name !== PAGE_CACHE && name !== ASSET_CACHE)
            .map((name) => self.caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new self.URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    if (url.pathname === HOME_PATH) {
      event.respondWith(navigateHome(event));
      return;
    }

    event.respondWith(navigateElsewhere(request));
    return;
  }

  if (url.pathname.startsWith(BUNDLE_PATH_PREFIX)) {
    event.respondWith(bundle(request));
    return;
  }

  event.respondWith(networkThenShellAsset(request));
});
