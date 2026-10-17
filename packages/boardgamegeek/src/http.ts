import { z } from 'zod';

/** BGG answers 429 when rate limited and 503 when overloaded. Both clear up if we wait. */
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;

/** BGG answered with a status we do not retry, or kept answering 429 or 503. */
export class BggHttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor({ status, url }: { status: number; url: string }) {
    super(`BGG answered ${status} for ${url}`);
    this.name = 'BggHttpError';
    this.status = status;
    this.url = url;
  }
}

/** BGG answered 200, but the body was not JSON or did not match the expected shape. */
export class BggResponseError extends Error {
  readonly url: string;

  constructor({ url, reason }: { url: string; reason: string }) {
    super(`Unexpected BGG response from ${url}: ${reason}`);
    this.name = 'BggResponseError';
    this.url = url;
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Exponential backoff from one second, unless BGG sent a `Retry-After` in seconds. Capped at 30
 * seconds either way.
 */
export function retryDelayMs({
  attempt,
  retryAfter,
}: {
  attempt: number;
  retryAfter: string | null;
}): number {
  const retryAfterSeconds = Number(retryAfter);

  if (retryAfter !== null && retryAfter.trim() !== '' && Number.isFinite(retryAfterSeconds)) {
    return Math.min(Math.max(retryAfterSeconds, 0) * 1000, MAX_RETRY_DELAY_MS);
  }

  return Math.min(INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
}

/** Spaces request starts at least `1 / requestsPerSecond` apart, however many callers queue. */
export class RequestThrottle {
  readonly #intervalMs: number;
  #nextSlotAt = 0;

  constructor({ requestsPerSecond }: { requestsPerSecond: number }) {
    this.#intervalMs = 1000 / requestsPerSecond;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const slotAt = Math.max(now, this.#nextSlotAt);

    // Reserve the slot before waiting, so concurrent callers queue behind each other.
    this.#nextSlotAt = slotAt + this.#intervalMs;

    if (slotAt > now) {
      await sleep(slotAt - now);
    }
  }
}

/**
 * Sends GET requests to BGG politely: every request carries the caller's `User-Agent`, passes
 * the requests-per-second throttle, and backs off on 429 and 503.
 */
export class PoliteHttpClient {
  readonly #userAgent: string;
  readonly #throttle: RequestThrottle;

  constructor({ userAgent, requestsPerSecond }: { userAgent: string; requestsPerSecond: number }) {
    this.#userAgent = userAgent;
    this.#throttle = new RequestThrottle({ requestsPerSecond });
  }

  /**
   * Fetches `url` and parses its JSON body with `schema`. Resolves to null on 404, which is how
   * BGG reports an unknown id.
   */
  async getJson<Schema extends z.ZodType>({
    url,
    schema,
  }: {
    url: string;
    schema: Schema;
  }): Promise<z.output<Schema> | null> {
    for (let attempt = 1; ; attempt += 1) {
      const response = await this.#send(url);

      if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
        return this.#read({ url, response, schema });
      }

      await response.body?.cancel();
      await sleep(retryDelayMs({ attempt, retryAfter: response.headers.get('retry-after') }));
    }
  }

  async #send(url: string): Promise<Response> {
    await this.#throttle.waitForSlot();

    return fetch(url, {
      headers: { 'User-Agent': this.#userAgent, Accept: 'application/json' },
    });
  }

  async #read<Schema extends z.ZodType>({
    url,
    response,
    schema,
  }: {
    url: string;
    response: Response;
    schema: Schema;
  }): Promise<z.output<Schema> | null> {
    if (response.status === 404) {
      await response.body?.cancel();

      return null;
    }

    if (!response.ok) {
      await response.body?.cancel();

      throw new BggHttpError({ status: response.status, url });
    }

    const body = parseJson({ url, text: await response.text() });
    const result = schema.safeParse(body);

    if (!result.success) {
      throw new BggResponseError({ url, reason: z.prettifyError(result.error) });
    }

    return result.data;
  }
}

function parseJson({ url, text }: { url: string; text: string }): unknown {
  try {
    const body: unknown = JSON.parse(text);

    return body;
  } catch {
    throw new BggResponseError({ url, reason: 'the body is not JSON' });
  }
}
