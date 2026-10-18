// Covers public/sw.js, which cannot keep its test beside it because everything in public/ is served.
// The script runs in a VM sandbox against an in-memory network and cache storage.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const SOURCE = readFileSync(fileURLToPath(new URL('../public/sw.js', import.meta.url)), 'utf8');
const ORIGIN = 'https://meeplewall.test';

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
}

interface WorkerEvent {
  request?: FakeRequest;
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith?: (response: Promise<Response>) => void;
}

type Listener = (event: WorkerEvent) => void;

function urlOf(input: string | FakeRequest): string {
  return new URL(typeof input === 'string' ? input : input.url, ORIGIN).href;
}

class FakeCache {
  readonly entries = new Map<string, Response>();

  constructor(private readonly network: FakeNetwork) {}

  match(input: string | FakeRequest): Promise<Response | undefined> {
    return Promise.resolve(this.entries.get(urlOf(input))?.clone());
  }

  put(input: string | FakeRequest, response: Response): Promise<void> {
    this.entries.set(urlOf(input), response);
    return Promise.resolve();
  }

  async addAll(urls: string[]): Promise<void> {
    const responses = await Promise.all(urls.map((url) => this.network.fetch(url)));
    responses.forEach((response, index) => this.entries.set(urlOf(urls[index] ?? ''), response));
  }

  keys(): Promise<FakeRequest[]> {
    return Promise.resolve(
      [...this.entries.keys()].map((url) => ({ url, method: 'GET', mode: 'cors' })),
    );
  }

  delete(input: string | FakeRequest): Promise<boolean> {
    return Promise.resolve(this.entries.delete(urlOf(input)));
  }
}

class FakeCacheStorage {
  readonly caches = new Map<string, FakeCache>();

  constructor(private readonly network: FakeNetwork) {}

  open(name: string): Promise<FakeCache> {
    const existing = this.caches.get(name);
    if (existing !== undefined) {
      return Promise.resolve(existing);
    }

    const cache = new FakeCache(this.network);
    this.caches.set(name, cache);
    return Promise.resolve(cache);
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.caches.keys()]);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.caches.delete(name));
  }

  /** Every URL cached under any name. */
  cachedUrls(): string[] {
    return [...this.caches.values()].flatMap((cache) => [...cache.entries.keys()]);
  }
}

class FakeNetwork {
  online = true;
  readonly routes = new Map<string, () => Response>();
  readonly requested: string[] = [];

  serve(path: string, body: string, init?: ResponseInit) {
    this.routes.set(new URL(path, ORIGIN).href, () => new Response(body, init));
  }

  fetch = (input: string | FakeRequest): Promise<Response> => {
    const url = urlOf(input);
    this.requested.push(url);
    if (!this.online) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }

    const route = this.routes.get(url);
    return Promise.resolve(
      route === undefined ? new Response('missing', { status: 404 }) : route(),
    );
  };
}

function page({ bundle, links = '' }: { bundle: string; links?: string }): string {
  return [
    '<!doctype html><html><head>',
    `<link rel="stylesheet" href="/_next/static/chunks/${bundle}.css"/>`,
    '<link rel="manifest" href="/manifest.webmanifest"/>',
    '<link rel="icon" href="/icon.svg?icon.0a1b2c3d" type="image/svg+xml"/>',
    `</head><body><img src="/powered-by-bgg-reversed.svg"/>${links}`,
    `<script src="/_next/static/chunks/${bundle}.js" async=""></script>`,
    `<script>self.__next_f.push([1,"0:{\\"P\\":\\"/_next/static/chunks/${bundle}-lazy.js\\"}"])</script>`,
    '</body></html>',
  ].join('');
}

const HOME_HTML = page({
  bundle: 'home',
  links: '<a href="/u/Alice">Alice</a><a href="/g/13">Catan</a>',
});
const OFFLINE_HTML = page({ bundle: 'offline' });

let network: FakeNetwork;
let storage: FakeCacheStorage;
let listeners: Map<string, Listener>;
const claim = vi.fn(() => Promise.resolve());
const skipWaiting = vi.fn(() => Promise.resolve());

function serveShell({ homeHtml }: { homeHtml: string }) {
  network.serve('/', homeHtml, { headers: { 'content-type': 'text/html' } });
  network.serve('/offline', OFFLINE_HTML, { headers: { 'content-type': 'text/html' } });
  for (const url of [
    '/manifest.webmanifest',
    '/icon.svg?icon.0a1b2c3d',
    '/powered-by-bgg-reversed.svg',
  ]) {
    network.serve(url, `file ${url}`);
  }
  for (const bundle of ['home', 'home-v2', 'offline']) {
    for (const suffix of ['.css', '.js', '-lazy.js']) {
      network.serve(`/_next/static/chunks/${bundle}${suffix}`, `${bundle}${suffix}`);
    }
  }
}

async function runLifecycle(type: 'install' | 'activate') {
  const pending: Promise<unknown>[] = [];
  listeners.get(type)?.({ waitUntil: (promise) => pending.push(promise) });
  await Promise.all(pending);
}

/** Dispatches a fetch event and waits for its response and any work it left running. */
async function dispatchFetch(
  path: string,
  { mode = 'cors', method = 'GET' }: { mode?: string; method?: string } = {},
): Promise<Response | undefined> {
  const pending: Promise<unknown>[] = [];
  let responded: Promise<Response> | undefined;
  listeners.get('fetch')?.({
    request: { url: new URL(path, ORIGIN).href, method, mode },
    waitUntil: (promise) => pending.push(promise),
    respondWith: (response) => {
      responded = response;
    },
  });
  if (responded === undefined) {
    return undefined;
  }

  const response = await responded;
  await Promise.all(pending);
  return response;
}

function navigate(path: string) {
  return dispatchFetch(path, { mode: 'navigate' });
}

async function bodyOf(response: Response | undefined): Promise<string> {
  if (response === undefined) {
    throw new Error('The service worker did not respond');
  }
  return response.text();
}

async function installed() {
  await runLifecycle('install');
  await runLifecycle('activate');
  network.requested.length = 0;
}

beforeEach(() => {
  network = new FakeNetwork();
  storage = new FakeCacheStorage(network);
  listeners = new Map();
  claim.mockClear();
  skipWaiting.mockClear();
  serveShell({ homeHtml: HOME_HTML });

  const self = {
    location: { origin: ORIGIN },
    URL,
    Response,
    fetch: network.fetch,
    caches: storage,
    clients: { claim },
    skipWaiting,
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  runInNewContext(SOURCE, { self });
});

describe('install', () => {
  it('caches both shell pages and every bundle, font and image they load', async () => {
    await installed();

    expect(storage.cachedUrls().sort()).toEqual(
      [
        '/',
        '/offline',
        '/manifest.webmanifest',
        '/icon.svg?icon.0a1b2c3d',
        '/powered-by-bgg-reversed.svg',
        ...['home', 'offline'].flatMap((bundle) =>
          ['.css', '.js', '-lazy.js'].map((suffix) => `/_next/static/chunks/${bundle}${suffix}`),
        ),
      ]
        .map((path) => new URL(path, ORIGIN).href)
        .sort(),
    );
    expect(skipWaiting).toHaveBeenCalled();
  });

  it('caches nothing under /u or /g, even when the home page links there', async () => {
    await installed();

    const cachedPaths = storage.cachedUrls().map((url) => new URL(url).pathname);
    expect(cachedPaths.filter((path) => /^\/(u|g)\//.test(path))).toEqual([]);
    expect(cachedPaths).toContain('/');
  });

  it('fails, so the browser retries later, when a shell page does not load', async () => {
    network.serve('/offline', 'boom', { status: 500 });

    await expect(runLifecycle('install')).rejects.toThrow('/offline answered 500');
    expect(skipWaiting).not.toHaveBeenCalled();
  });
});

describe('activate', () => {
  it('drops caches from an earlier version and claims open pages', async () => {
    await storage.open('meeplewall-pages-v0');
    await storage.open('another-app');

    await installed();

    expect([...storage.caches.keys()].sort()).toEqual([
      'another-app',
      'meeplewall-assets-v1',
      'meeplewall-pages-v1',
    ]);
    expect(claim).toHaveBeenCalled();
  });
});

describe('navigating offline', () => {
  beforeEach(async () => {
    await installed();
    network.online = false;
  });

  it('serves the cached home page at /', async () => {
    expect(await bodyOf(await navigate('/'))).toBe(HOME_HTML);
  });

  it('serves the cached home page at / with a query string', async () => {
    expect(await bodyOf(await navigate('/?ref=install'))).toBe(HOME_HTML);
  });

  it.each(['/u/foo', '/u/foo/g/13', '/g/13', '/about'])(
    'serves the offline page at %s',
    async (path) => {
      expect(await bodyOf(await navigate(path))).toBe(OFFLINE_HTML);
    },
  );

  it('serves cached bundles and shell images', async () => {
    expect(await bodyOf(await dispatchFetch('/_next/static/chunks/home.js'))).toBe('home.js');
    expect(await bodyOf(await dispatchFetch('/powered-by-bgg-reversed.svg'))).toBe(
      'file /powered-by-bgg-reversed.svg',
    );
  });

  it('fails a request it has nothing cached for', async () => {
    await expect(dispatchFetch('/api/sync/foo')).rejects.toThrow('Failed to fetch');
  });
});

describe('navigating offline before the shell is cached', () => {
  it('answers with a network error', async () => {
    network.online = false;

    const response = await navigate('/u/foo');

    expect(response?.type).toBe('error');
  });
});

describe('navigating online', () => {
  beforeEach(installed);

  it('serves collection and game pages from the network and caches none of them', async () => {
    network.serve('/u/foo', 'collection');
    network.serve('/g/13', 'game');

    expect(await bodyOf(await navigate('/u/foo'))).toBe('collection');
    expect(await bodyOf(await navigate('/g/13'))).toBe('game');
    expect(storage.cachedUrls().filter((url) => /\/(u|g)\//.test(url))).toEqual([]);
  });

  it('serves the home page from the network and keeps the shell when nothing changed', async () => {
    expect(await bodyOf(await navigate('/'))).toBe(HOME_HTML);

    expect(network.requested).toEqual([`${ORIGIN}/`]);
  });

  it('recaches the shell and drops old bundles after a deploy changes the home page', async () => {
    const deployedHome = page({ bundle: 'home-v2' });
    serveShell({ homeHtml: deployedHome });

    expect(await bodyOf(await navigate('/'))).toBe(deployedHome);

    const cached = storage.cachedUrls();
    expect(cached).toContain(`${ORIGIN}/_next/static/chunks/home-v2.js`);
    expect(cached).not.toContain(`${ORIGIN}/_next/static/chunks/home.js`);
    network.online = false;
    expect(await bodyOf(await navigate('/'))).toBe(deployedHome);
  });

  it('caches a bundle it had not seen on first use and serves it from the cache after', async () => {
    network.serve('/_next/static/chunks/game.js', 'game.js');

    expect(await bodyOf(await dispatchFetch('/_next/static/chunks/game.js'))).toBe('game.js');
    network.online = false;
    expect(await bodyOf(await dispatchFetch('/_next/static/chunks/game.js'))).toBe('game.js');
  });

  it('does not cache a bundle that failed to load', async () => {
    await dispatchFetch('/_next/static/chunks/gone.js');

    expect(storage.cachedUrls()).not.toContain(`${ORIGIN}/_next/static/chunks/gone.js`);
  });

  it('prefers the network for shell images, so an updated file shows', async () => {
    network.serve('/powered-by-bgg-reversed.svg', 'updated');

    expect(await bodyOf(await dispatchFetch('/powered-by-bgg-reversed.svg'))).toBe('updated');
  });
});

describe('requests it leaves alone', () => {
  it('ignores a request that is not a GET', async () => {
    expect(await dispatchFetch('/api/refresh/foo', { method: 'POST' })).toBeUndefined();
  });

  it('ignores another origin', async () => {
    expect(await dispatchFetch('https://cf.geekdo-images.com/cover.jpg')).toBeUndefined();
  });
});
