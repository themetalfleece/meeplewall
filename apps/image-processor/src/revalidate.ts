const REVALIDATE_PATH = '/api/internal/revalidate';
const TIMEOUT_MILLISECONDS = 10_000;

/** Tells apps/web to re-render the pages that show a game. */
export type Revalidate = (options: { bggGameId: number }) => Promise<void>;

/**
 * Returns a client for apps/web's revalidate route. It POSTs `{ bggGameId }`
 * as JSON with the shared secret as a bearer token.
 */
export function createRevalidate({
  webInternalUrl,
  secret,
}: {
  webInternalUrl: string;
  secret: string;
}): Revalidate {
  const endpoint = new URL(REVALIDATE_PATH, webInternalUrl);

  return async ({ bggGameId }) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ bggGameId }),
      signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS),
    });
    await response.body?.cancel();
    if (!response.ok) {
      throw new Error(`Revalidate failed with ${response.status}`);
    }
  };
}
