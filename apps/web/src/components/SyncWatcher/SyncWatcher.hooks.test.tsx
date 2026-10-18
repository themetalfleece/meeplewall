// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SyncStatus } from '@/lib/sync-status';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { useRefreshCollection, useRefreshWhenSyncFinishes, useSyncStatus } =
  await import('./SyncWatcher.hooks');
const { POLL_INTERVAL_MS } = await import('./SyncWatcher.constants');

const RUNNING: SyncStatus = {
  state: 'running',
  startedAt: '2026-10-18T10:00:00.000Z',
  finishedAt: null,
};
const SUCCEEDED: SyncStatus = {
  ...RUNNING,
  state: 'succeeded',
  finishedAt: '2026-10-18T10:02:00.000Z',
};

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

function render(element: ReactNode) {
  act(() => {
    root.render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
  });
}

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
});

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  act(() => root.unmount());
  queryClient.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function StateProbe({ state }: { state: SyncStatus['state'] }) {
  useRefreshWhenSyncFinishes(state);
  return null;
}

describe('useRefreshWhenSyncFinishes', () => {
  it('refreshes the route when a running sync succeeds', () => {
    render(<StateProbe state="running" />);
    render(<StateProbe state="succeeded" />);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh a page that rendered an already finished sync', () => {
    render(<StateProbe state="succeeded" />);

    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not refresh when a sync fails', () => {
    render(<StateProbe state="running" />);
    render(<StateProbe state="failed" />);

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('useSyncStatus', () => {
  const seen: SyncStatus[] = [];

  function StatusProbe({ initialStatus }: { initialStatus: SyncStatus }) {
    seen.push(useSyncStatus({ username: 'alice', initialStatus }));
    return null;
  }

  beforeEach(() => {
    seen.length = 0;
  });

  it('polls a running sync until it finishes, then refreshes the route', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(SUCCEEDED)));

    render(<StatusProbe initialStatus={RUNNING} />);
    expect(seen.at(-1)).toEqual(RUNNING);

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 50));

    expect(seen.at(-1)).toEqual(SUCCEEDED);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/sync/alice');
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not poll a finished sync', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<StatusProbe initialStatus={SUCCEEDED} />);
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('useRefreshCollection', () => {
  let mutation: ReturnType<typeof useRefreshCollection> | undefined;

  function MutationProbe() {
    mutation = useRefreshCollection({ username: 'alice' });
    return null;
  }

  it('stores the status the refresh returns, so polling starts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(RUNNING), { status: 202 }),
    );
    render(<MutationProbe />);

    await act(() => mutation?.mutateAsync());

    expect(queryClient.getQueryData(['sync-status', 'alice'])).toEqual(RUNNING);
  });
});
