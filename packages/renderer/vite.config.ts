import { defineConfig } from 'vite';

// `pnpm --filter @meeplewall/renderer dev` serves dev.html. `public/` holds the
// legacy practice page it compares against and the sample textures both draw.
export default defineConfig({
  server: {
    open: '/dev.html',
  },
});
