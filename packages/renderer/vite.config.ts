import { defineConfig } from 'vite';

// `pnpm --filter @meeplewall/renderer dev` serves dev.html. The legacy public
// directory supplies the practice page it compares against and the textures
// both renderers draw, read in place so nothing is copied out of the frozen app.
export default defineConfig({
  publicDir: '../../apps/web-legacy/public',
  server: {
    open: '/dev.html',
  },
});
