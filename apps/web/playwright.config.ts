import { defineConfig } from '@playwright/test';

// Kept clear of the dev server's 3000.
const PORT = 3210;
const ORIGIN = `http://localhost:${PORT}`;

/** Browser checks against the standalone build. Run `pnpm build` first. */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: true,
  reporter: 'list',
  use: {
    baseURL: ORIGIN,
    // No channel: Playwright's bundled Chromium, never Edge. See the testing skill.
  },
  webServer: {
    command: 'node e2e/serve-standalone.ts',
    // The home page is prerendered, so this answers without Postgres.
    url: ORIGIN,
    env: { PORT: String(PORT), HOSTNAME: 'localhost' },
    reuseExistingServer: false,
  },
});
