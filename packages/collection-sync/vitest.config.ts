import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const PACKAGE_ROOT = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  test: {
    // Picks up DATABASE_URL from this package's .env.local, or the shell.
    env: loadEnv(mode, PACKAGE_ROOT, ''),
    // Each test file creates and migrates its own throwaway database.
    hookTimeout: 30_000,
  },
}));
