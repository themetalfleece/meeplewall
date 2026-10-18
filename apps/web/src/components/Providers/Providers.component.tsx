'use client';

import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query-client';

import type { ProvidersProps } from './Providers.types';

/** Client-side context every page shares: the TanStack Query client. */
export function Providers({ children }: ProvidersProps) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
