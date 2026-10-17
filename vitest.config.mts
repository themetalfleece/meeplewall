import { defineConfig } from 'vitest/config';

// Running Vitest from the root runs every workspace's tests. The frozen legacy
// app has none and is not part of the gate.
export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*', '!apps/web-legacy'],
  },
});
