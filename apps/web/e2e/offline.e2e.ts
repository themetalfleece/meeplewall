import { chromium, expect, test, type Page } from '@playwright/test';

/** Loads `/` online and waits until the service worker controls the page and has cached the shell. */
async function loadControlledHome(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

test('the manifest is valid, the app installable and the service worker registered', async ({
  browserName,
}, testInfo) => {
  test.skip(browserName !== 'chromium', 'Installability is a Chromium DevTools check');
  const { baseURL } = testInfo.project.use;
  if (baseURL === undefined) {
    throw new Error('playwright.config.ts sets no baseURL');
  }
  // Chromium never offers to install from an incognito profile, which every default context is.
  const context = await chromium.launchPersistentContext(testInfo.outputPath('profile'), {
    baseURL,
  });

  try {
    const page = await context.newPage();
    await loadControlledHome(page);
    const devTools = await context.newCDPSession(page);

    const manifest = await devTools.send('Page.getAppManifest');
    const { installabilityErrors } = await devTools.send('Page.getInstallabilityErrors');
    const scriptUrl = await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL,
    );

    expect(manifest.errors).toEqual([]);
    expect(installabilityErrors).toEqual([]);
    expect(scriptUrl).toMatch(/\/sw\.js$/);
  } finally {
    await context.close();
  }
});

test('the shell caches hold nothing under /u or /g', async ({ page }) => {
  await loadControlledHome(page);

  const cachedPaths = await page.evaluate(async () => {
    const names = await caches.keys();
    const requests = await Promise.all(names.map(async (name) => (await caches.open(name)).keys()));
    return requests.flat().map((request) => new URL(request.url).pathname);
  });

  expect(cachedPaths).toContain('/');
  expect(cachedPaths).toContain('/offline');
  expect(cachedPaths.filter((path) => /^\/(u|g)\//.test(path))).toEqual([]);
});

test('offline, / shows the cached shell and /u/foo the offline page', async ({
  page,
  context,
}, testInfo) => {
  await loadControlledHome(page);
  const failedBundles: string[] = [];
  page.on('requestfailed', (request) => {
    if (request.url().includes('/_next/static/')) {
      failedBundles.push(request.url());
    }
  });

  await context.setOffline(true);

  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Board game collections, shelved as boxes.' }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('home-offline.png'), fullPage: true });

  await page.goto('/u/foo');
  await expect(page.getByRole('heading', { level: 1, name: 'You are offline' })).toBeVisible();
  await expect(page).toHaveURL(/\/u\/foo$/);
  await page.screenshot({ path: testInfo.outputPath('collection-offline.png'), fullPage: true });

  expect(failedBundles).toEqual([]);
});
