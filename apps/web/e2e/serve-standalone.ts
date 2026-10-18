// Serves the standalone build as apps/web/Dockerfile does: public/ and .next/static copied beside
// server.js, which then serves them itself.
import { cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const standaloneDirectory = path.join(appDirectory, '.next', 'standalone', 'apps', 'web');

cpSync(path.join(appDirectory, 'public'), path.join(standaloneDirectory, 'public'), {
  recursive: true,
});
cpSync(
  path.join(appDirectory, '.next', 'static'),
  path.join(standaloneDirectory, '.next', 'static'),
  { recursive: true },
);

await import(pathToFileURL(path.join(standaloneDirectory, 'server.js')).href);
