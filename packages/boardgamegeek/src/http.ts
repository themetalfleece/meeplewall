import { z } from 'zod';

/** BGG answers 429 when rate limited and 503 when overloaded. Both clear up if we wait. */
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MILLISECONDS = 1000;
const MAX_RETRY_DELAY_MILLISECONDS = 30_000;

/** The options every BGG client takes for its `PoliteHttpClient`. */
export const politeHttpClientOptionsSchema = z.object({
  userAgent: z.string().trim().min(1),
  requestsPerSecond: z.number().positive().max(10),
});

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

/** BGG answered 200, but the body did not parse or did not match the expected shape. */
export class BggResponseError extends Error {
  readonly url: string;

  constructor({ url, reason }: { url: string; reason: string }) {
    super(`Unexpected BGG response from ${url}: ${reason}`);
    this.name = 'BggResponseError';
    this.url = url;
  }
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/** Discards the body of a non-2xx response and throws `BggHttpError` for it. */
export async function throwUnlessOk({
  url,
  response,
}: {
  url: string;
  response: Response;
}): Promise<void> {
  if (response.ok) {
    return;
  }

  await response.body?.cancel();

  throw new BggHttpError({ status: response.status, url });
}

/**
 * Exponential backoff from one second, unless BGG sent a `Retry-After` in seconds. Capped at 30
 * seconds either way.
 */
export function retryDelayMilliseconds({
  attempt,
  retryAfter,
}: {
  attempt: number;
  retryAfter: string | null;
}): number {
  const retryAfterSeconds = Number(retryAfter);

  if (retryAfter !== null && retryAfter.trim() !== '' && Number.isFinite(retryAfterSeconds)) {
    return Math.min(Math.max(retryAfterSeconds, 0) * 1000, MAX_RETRY_DELAY_MILLISECONDS);
  }

  return Math.min(
    INITIAL_RETRY_DELAY_MILLISECONDS * 2 ** (attempt - 1),
    MAX_RETRY_DELAY_MILLISECONDS,
  );
}

/** Spaces request starts at least `1 / requestsPerSecond` apart, however many callers queue. */
export class RequestThrottle {
  readonly #intervalMilliseconds: number;
  #nextSlotAt = 0;

  constructor({ requestsPerSecond }: { requestsPerSecond: number }) {
    this.#intervalMilliseconds = 1000 / requestsPerSecond;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const slotAt = Math.max(now, this.#nextSlotAt);

    // Reserve the slot before waiting, so concurrent callers queue behind each other.
    this.#nextSlotAt = slotAt + this.#intervalMilliseconds;

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
    const response = await this.get({ url, headers: { Accept: 'application/json' } });

    if (response.status === 404) {
      await response.body?.cancel();

      return null;
    }

    await throwUnlessOk({ url, response });

    const result = schema.safeParse(parseJson({ url, text: await response.text() }));

    if (!result.success) {
      throw new BggResponseError({ url, reason: z.prettifyError(result.error) });
    }

    return result.data;
  }

  /**
   * Sends one GET through the throttle, retrying while BGG answers 429 or 503, and returns the
   * last response unread. `headers` are added to the `User-Agent`.
   */
  async get({ url, headers }: { url: string; headers: Record<string, string> }): Promise<Response> {
    for (let attempt = 1; ; attempt += 1) {
      await this.#throttle.waitForSlot();
      const response = await fetch(url, { headers: { ...headers, 'User-Agent': this.#userAgent } });

      if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
        return response;
      }

      await response.body?.cancel();
      await sleep(
        retryDelayMilliseconds({ attempt, retryAfter: response.headers.get('retry-after') }),
      );
    }
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
