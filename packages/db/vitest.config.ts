import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => ({
  test: {
    // Picks up DATABASE_URL from the repo root .env.local, like the seed script.
    env: loadEnv(mode, REPO_ROOT, ''),
    // Each test file creates and migrates its own throwaway database.
    hookTimeout: 30_000,
  },
}));
