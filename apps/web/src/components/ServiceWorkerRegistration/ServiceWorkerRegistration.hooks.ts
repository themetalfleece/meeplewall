import { useEffect } from 'react';

import { isProductionBuild } from '@/lib/env';

import { SERVICE_WORKER_URL } from './ServiceWorkerRegistration.constants';

/**
 * Registers public/sw.js, which keeps the app shell for offline use. Production builds only: in
 * development it would serve cached bundles over fresh ones.
 */
export function useServiceWorkerRegistration() {
  useEffect(() => {
    if (!isProductionBuild() || !('serviceWorker' in navigator)) {
      return;
    }

    // updateViaCache 'none' fetches sw.js past the HTTP cache on each update check.
    navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: '/', updateViaCache: 'none' })
      .catch((error: unknown) => {
        console.error('Service worker registration failed', error);
      });
  }, []);
}
