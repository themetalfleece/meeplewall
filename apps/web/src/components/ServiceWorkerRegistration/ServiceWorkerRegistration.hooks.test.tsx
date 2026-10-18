// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useServiceWorkerRegistration } from './ServiceWorkerRegistration.hooks';

let container: HTMLDivElement;
let root: Root;
const register = vi.fn();

function Probe() {
  useServiceWorkerRegistration();
  return null;
}

function mount() {
  act(() => root.render(<Probe />));
}

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
});

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  register.mockResolvedValue({});
  Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
});

afterEach(() => {
  act(() => root.unmount());
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  register.mockReset();
});

describe('useServiceWorkerRegistration', () => {
  it('registers sw.js for the whole site in a production build', () => {
    vi.stubEnv('NODE_ENV', 'production');

    mount();

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  });

  it('registers nothing in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    mount();

    expect(register).not.toHaveBeenCalled();
  });

  it('does nothing in a browser without service workers', () => {
    vi.stubEnv('NODE_ENV', 'production');
    Reflect.deleteProperty(navigator, 'serviceWorker');

    expect(() => mount()).not.toThrow();
  });

  it('logs a failed registration instead of throwing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const failure = new Error('blocked');
    register.mockRejectedValue(failure);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mount();
    await act(() => Promise.resolve());

    expect(consoleError).toHaveBeenCalledWith('Service worker registration failed', failure);
  });
});
