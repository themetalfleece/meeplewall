/**
 * Downloads a source image, refusing anything over `maxBytes` and anything
 * slower than `timeoutMilliseconds`, so one bad source cannot outlive the lease
 * or exhaust memory.
 *
 * @throws Error on a non-OK status (`Source fetch failed with <status>`), an
 * oversized body, a timeout or a network failure.
 */
export async function downloadSource({
  sourceUrl,
  timeoutMilliseconds,
  maxBytes,
}: {
  sourceUrl: string;
  timeoutMilliseconds: number;
  maxBytes: number;
}): Promise<Buffer> {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(timeoutMilliseconds) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Source fetch failed with ${response.status}`);
  }
  // Checked before reading, so an oversized body is never buffered.
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new Error(`Source is larger than ${maxBytes} bytes`);
  }

  // A chunked response declares no length, so the body is checked too.
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength > maxBytes) {
    throw new Error(`Source is larger than ${maxBytes} bytes`);
  }

  return body;
}
