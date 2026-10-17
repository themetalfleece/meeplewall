import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => ({
  test: {
    // The worker suite reads DATABASE_URL and STORAGE_* from the repo root .env.local, or from
    // the shell when CI sets them.
    env: loadEnv(mode, REPO_ROOT, ''),
    // Each worker suite creates and migrates its own throwaway database.
    hookTimeout: 30_000,
  },
}));
