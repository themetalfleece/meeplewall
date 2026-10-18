import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

// The minio round trip reads the STORAGE_* variables from this package's .env.local, or from the
// shell when CI sets them.
export default defineConfig({
  test: {
    env: loadEnv('test', packageRoot, 'STORAGE_'),
  },
});
