import { defineConfig } from 'vitest/config';

// Running Vitest from the root runs every workspace's tests.
export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
  },
});
