import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** A request the stub received, with its body read in full. */
export interface RecordedRequest {
  method: string;
  path: string;
  headers: IncomingMessage['headers'];
  body: string;
}

/** What the stub sends back for one path. */
export interface StubResponse {
  status: number;
  body?: Uint8Array | string;
  contentType?: string;
  /** Extra headers, such as a `content-length` that does not match the body. */
  headers?: Record<string, string>;
  /** Holds the response until this resolves, to keep a job in flight. */
  waitFor?: Promise<void>;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    if (chunk instanceof Buffer) {
      chunks.push(chunk);
    }
  }

  return Buffer.concat(chunks).toString('utf8');
}

/**
 * A local HTTP server that answers each path with a canned response and
 * records every request. It stands in for the BGG image CDN and for apps/web.
 */
export class StubServer {
  readonly requests: RecordedRequest[] = [];
  readonly #routes = new Map<string, StubResponse>();
  readonly #server: Server;

  private constructor() {
    this.#server = createServer((request, response) => {
      void this.#respond(request, response);
    });
  }

  static async start(): Promise<StubServer> {
    const stub = new StubServer();
    await new Promise<void>((resolve) => {
      stub.#server.listen(0, '127.0.0.1', resolve);
    });

    return stub;
  }

  get baseUrl(): string {
    const address: AddressInfo | string | null = this.#server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('The stub server is not listening on a TCP port');
    }

    return `http://127.0.0.1:${address.port}`;
  }

  url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  route({ path, response }: { path: string; response: StubResponse }): void {
    this.#routes.set(path, response);
  }

  requestsTo(path: string): RecordedRequest[] {
    return this.requests.filter((request) => request.path === path);
  }

  reset(): void {
    this.requests.length = 0;
    this.#routes.clear();
  }

  async close(): Promise<void> {
    this.#server.closeAllConnections();
    await new Promise<void>((resolve) => {
      this.#server.close(() => {
        resolve();
      });
    });
  }

  async #respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = request.url ?? '/';
    this.requests.push({
      method: request.method ?? 'GET',
      path,
      headers: request.headers,
      body: await readBody(request),
    });

    const route = this.#routes.get(path);
    if (route === undefined) {
      response.writeHead(404).end();
      return;
    }
    await route.waitFor;
    const headers: Record<string, string> = { ...route.headers };
    if (route.contentType !== undefined) {
      headers['content-type'] = route.contentType;
    }
    response.writeHead(route.status, headers).end(route.body);
  }
}
