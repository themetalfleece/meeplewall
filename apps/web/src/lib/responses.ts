/** Every API answer here is per-user and changes as syncs run, so none may be cached. */
export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export function jsonError({ message, status }: { message: string; status: number }): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE_HEADERS });
}
