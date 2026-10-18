import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

/** Resolves true while the process can do its job. */
export type HealthCheck = () => Promise<boolean>;

function sendJson({
  response,
  status,
  body,
}: {
  response: ServerResponse;
  status: number;
  body: Record<string, string>;
}): void {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

/** A check that throws or outlives `timeoutMilliseconds` counts as unhealthy. */
async function runCheck({
  check,
  timeoutMilliseconds,
}: {
  check: HealthCheck;
  timeoutMilliseconds: number;
}): Promise<boolean> {
  const failed = check().catch(() => false);
  const timedOut = delay(timeoutMilliseconds, false, { ref: false });

  return Promise.race([failed, timedOut]);
}

/** Serves `GET /healthz`: 200 when the check passes, 503 when it does not, 404 for anything else. */
export class HealthServer {
  readonly #server: Server;

  private constructor(server: Server) {
    this.#server = server;
  }

  static async start({
    port,
    check,
    timeoutMilliseconds,
  }: {
    port: number;
    check: HealthCheck;
    timeoutMilliseconds: number;
  }): Promise<HealthServer> {
    const respond = async (request: IncomingMessage, response: ServerResponse) => {
      const { pathname } = new URL(request.url ?? '/', 'http://localhost');
      if (request.method !== 'GET' || pathname !== '/healthz') {
        sendJson({ response, status: 404, body: { status: 'not found' } });
        return;
      }

      const healthy = await runCheck({ check, timeoutMilliseconds });
      if (healthy) {
        sendJson({ response, status: 200, body: { status: 'ok' } });
        return;
      }
      sendJson({ response, status: 503, body: { status: 'unavailable' } });
    };
    const server = createServer((request, response) => {
      void respond(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, () => {
        server.off('error', reject);
        resolve();
      });
    });

    return new HealthServer(server);
  }

  /** The port it listens on, which differs from the requested one when that was 0. */
  get port(): number {
    const address: AddressInfo | string | null = this.#server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('The health server is not listening on a TCP port');
    }

    return address.port;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#server.close((error) => {
        if (error === undefined) {
          resolve();
          return;
        }
        reject(error);
      });
    });
  }
}
