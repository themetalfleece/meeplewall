import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

// The minio round trip reads the STORAGE_* variables from the root .env.local, or from the
// shell when CI sets them.
export default defineConfig({
  test: {
    env: loadEnv('test', repositoryRoot, 'STORAGE_'),
  },
});
