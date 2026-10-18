import { afterEach, describe, expect, it } from 'vitest';

import { HealthServer, type HealthCheck } from './health-server.ts';

const passing: HealthCheck = () => Promise.resolve(true);

describe('HealthServer', () => {
  let server: HealthServer | undefined;

  async function start(check: HealthCheck) {
    server = await HealthServer.start({ port: 0, check, timeoutMilliseconds: 200 });
    return `http://127.0.0.1:${server.port}`;
  }

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('answers 200 when the check passes', async () => {
    const baseUrl = await start(passing);

    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('ignores a query string', async () => {
    const baseUrl = await start(passing);

    expect((await fetch(`${baseUrl}/healthz?probe=1`)).status).toBe(200);
  });

  it('answers 503 when the check fails', async () => {
    const baseUrl = await start(() => Promise.resolve(false));

    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });

  it('answers 503 when the check throws', async () => {
    const baseUrl = await start(() => Promise.reject(new Error('connection refused')));

    expect((await fetch(`${baseUrl}/healthz`)).status).toBe(503);
  });

  it('answers 503 when the check outlives its timeout', async () => {
    const baseUrl = await start(() => new Promise<boolean>(() => {}));

    expect((await fetch(`${baseUrl}/healthz`)).status).toBe(503);
  });

  it('answers 404 for any other path or method', async () => {
    const baseUrl = await start(passing);

    expect((await fetch(`${baseUrl}/`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/healthz`, { method: 'POST' })).status).toBe(404);
  });

  it('rejects when the port is already taken', async () => {
    await start(passing);
    const takenPort = server?.port ?? 0;

    await expect(
      HealthServer.start({ port: takenPort, check: passing, timeoutMilliseconds: 200 }),
    ).rejects.toThrow(/EADDRINUSE/);
  });
});
