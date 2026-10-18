import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const PACKAGE_ROOT = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  test: {
    // The live collection suite reads BGG_API_TOKEN from this package's .env.local, or the shell.
    env: loadEnv(mode, PACKAGE_ROOT, ''),
  },
}));
