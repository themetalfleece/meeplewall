import { defineConfig } from 'drizzle-kit';

// Only `generate` uses this file, and it needs no database connection.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './src/migrations',
});
