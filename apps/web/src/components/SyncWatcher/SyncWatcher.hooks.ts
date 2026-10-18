import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import type { SyncStatus } from '@/lib/sync-status';

import { POLL_INTERVAL_MS } from './SyncWatcher.constants';
import {
  fetchSyncStatus,
  pollInterval,
  requestRefresh,
  syncStatusQueryKey,
} from './SyncWatcher.data';

/** Re-renders the route once a sync this page watched succeeds, so the new grid shows. */
export function useRefreshWhenSyncFinishes(state: SyncStatus['state']): void {
  const router = useRouter();
  const previousState = useRef(state);

  useEffect(() => {
    if (previousState.current === 'running' && state === 'succeeded') {
      router.refresh();
    }
    previousState.current = state;
  }, [state, router]);
}

/** A user's sync status, polled while a sync runs, starting from what the server rendered. */
export function useSyncStatus({
  username,
  initialStatus,
}: {
  username: string;
  initialStatus: SyncStatus;
}): SyncStatus {
  const { data } = useQuery({
    queryKey: syncStatusQueryKey(username),
    queryFn: ({ signal }) => fetchSyncStatus({ username, signal }),
    initialData: initialStatus,
    // The server just rendered this status, so mounting should not ask again at once.
    staleTime: POLL_INTERVAL_MS,
    refetchInterval: (query) => pollInterval(query.state.data),
  });

  useRefreshWhenSyncFinishes(data.state);

  return data;
}

/** The manual refresh button's request. A throttled answer is reported, not thrown. */
export function useRefreshCollection({ username }: { username: string }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => requestRefresh({ username }),
    onSuccess: (result) => {
      queryClient.setQueryData(syncStatusQueryKey(username), result.status);
    },
  });
}
