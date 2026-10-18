import { QueryClient } from '@tanstack/react-query';

let browserQueryClient: QueryClient | undefined;

/**
 * A fresh client per server render, so requests never share cached data, and one client for
 * the life of the browser tab.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return new QueryClient();
  }
  browserQueryClient ??= new QueryClient();

  return browserQueryClient;
}
