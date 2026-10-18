// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DISMISSED_STORAGE_KEY } from './InstallPrompt.constants';
import { useInstallPrompt } from './InstallPrompt.hooks';
import type { BeforeInstallPromptEvent } from './InstallPrompt.types';

type PromptState = ReturnType<typeof useInstallPrompt>;

let container: HTMLDivElement;
let root: Root;
let latest: PromptState | undefined;

function Probe() {
  latest = useInstallPrompt();
  return null;
}

function current(): PromptState {
  if (latest === undefined) {
    throw new Error('The hook has not rendered');
  }
  return latest;
}

function mount() {
  act(() => root.render(<Probe />));
}

/** A `beforeinstallprompt` event as Chrome fires it, with a prompt the test can watch. */
function firePrompt(): { event: BeforeInstallPromptEvent; prompt: ReturnType<typeof vi.fn> } {
  const prompt = vi.fn(() => Promise.resolve());
  const userChoice: BeforeInstallPromptEvent['userChoice'] = Promise.resolve({
    outcome: 'accepted',
    platform: 'web',
  });
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

function stubPlatform({ userAgent, standalone }: { userAgent: string; standalone: boolean }) {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({ matches: standalone }),
    configurable: true,
  });
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
});

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  stubPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0', standalone: false });
});

afterEach(() => {
  act(() => root.unmount());
  latest = undefined;
  Reflect.deleteProperty(window, 'matchMedia');
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('useInstallPrompt', () => {
  it('shows nothing until the browser offers a prompt', () => {
    mount();

    expect(current().view).toBe('hidden');
  });

  it("offers the browser's prompt in place of Chrome's own infobar", () => {
    mount();

    const { event } = firePrompt();

    expect(event.defaultPrevented).toBe(true);
    expect(current().view).toBe('install');
  });

  it('prompts once when the user installs, then hides', () => {
    mount();
    const { prompt } = firePrompt();

    act(() => current().install());
    act(() => current().install());

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(current().view).toBe('hidden');
  });

  it('hides once the app is installed', () => {
    mount();
    firePrompt();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(current().view).toBe('hidden');
  });

  it('explains Add to Home Screen on iOS, where there is no prompt event', () => {
    stubPlatform({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      standalone: false,
    });

    mount();

    expect(current().view).toBe('ios-hint');
  });

  it('shows nothing inside the installed app', () => {
    stubPlatform({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      standalone: true,
    });

    mount();

    expect(current().view).toBe('hidden');
  });

  it('stays closed after the user dismisses it, on this visit and the next', () => {
    mount();
    firePrompt();

    act(() => current().dismiss());

    expect(current().view).toBe('hidden');
    expect(localStorage.getItem(DISMISSED_STORAGE_KEY)).not.toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    mount();
    firePrompt();
    expect(current().view).toBe('hidden');
  });

  it('stops listening once unmounted', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    mount();

    act(() => root.unmount());
    root = createRoot(container);

    expect(removeListener).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });
});
