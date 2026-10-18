'use client';

import { useServiceWorkerRegistration } from './ServiceWorkerRegistration.hooks';

/** Renders nothing; registers the service worker once the page has mounted. */
export function ServiceWorkerRegistration() {
  useServiceWorkerRegistration();
  return null;
}
