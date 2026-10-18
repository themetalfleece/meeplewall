/**
 * The URL an object is served from publicly, given the bucket's public base URL. Each key
 * segment is percent-encoded and the slashes kept. Makes no request.
 */
export function publicObjectUrl({
  publicBaseUrl,
  key,
}: {
  publicBaseUrl: string;
  key: string;
}): string {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');

  return `${publicBaseUrl.replace(/\/+$/, '')}/${encodedKey}`;
}
