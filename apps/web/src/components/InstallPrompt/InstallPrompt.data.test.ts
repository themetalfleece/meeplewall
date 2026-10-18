// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DISMISSED_STORAGE_KEY } from './InstallPrompt.constants';
import {
  installPromptView,
  isIosDevice,
  readInstallEnvironment,
  rememberDismissal,
} from './InstallPrompt.data';
import type { InstallEnvironment } from './InstallPrompt.types';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const BROWSER_TAB: InstallEnvironment = { isIos: false, isInstalled: false, isDismissed: false };

/** jsdom has no matchMedia, so each test defines the one query the code asks. */
function stubStandalone(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches }), configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
  Reflect.deleteProperty(navigator, 'standalone');
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('isIosDevice', () => {
  it('recognises an iPhone', () => {
    expect(isIosDevice({ userAgent: IPHONE_SAFARI, platform: 'iPhone', maxTouchPoints: 5 })).toBe(
      true,
    );
  });

  it('recognises an iPad that reports a Mac user agent', () => {
    expect(isIosDevice({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(
      true,
    );
  });

  it('does not mistake a Mac for an iPad', () => {
    expect(isIosDevice({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(
      false,
    );
  });

  it('does not match a desktop browser', () => {
    expect(isIosDevice({ userAgent: WINDOWS_CHROME, platform: 'Win32', maxTouchPoints: 0 })).toBe(
      false,
    );
  });
});

describe('readInstallEnvironment', () => {
  it('reads a fresh browser tab', () => {
    stubStandalone(false);

    expect(readInstallEnvironment(window)).toEqual(BROWSER_TAB);
  });

  it('reads an installed app from the display mode', () => {
    stubStandalone(true);

    expect(readInstallEnvironment(window).isInstalled).toBe(true);
  });

  it("reads an iOS home screen app from Safari's standalone flag", () => {
    stubStandalone(false);
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });

    expect(readInstallEnvironment(window).isInstalled).toBe(true);
  });

  it('reads an earlier dismissal', () => {
    stubStandalone(false);
    localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');

    expect(readInstallEnvironment(window).isDismissed).toBe(true);
  });

  it('treats blocked storage as never dismissed', () => {
    stubStandalone(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(readInstallEnvironment(window).isDismissed).toBe(false);
  });
});

describe('rememberDismissal', () => {
  it('stores the dismissal', () => {
    rememberDismissal(window);

    expect(localStorage.getItem(DISMISSED_STORAGE_KEY)).not.toBeNull();
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => rememberDismissal(window)).not.toThrow();
  });
});

describe('installPromptView', () => {
  it('shows nothing before the page has mounted', () => {
    expect(installPromptView({ environment: null, canPrompt: true })).toBe('hidden');
  });

  it('offers the browser prompt once it is available', () => {
    expect(installPromptView({ environment: BROWSER_TAB, canPrompt: true })).toBe('install');
  });

  it('shows nothing in a browser that has not offered a prompt', () => {
    expect(installPromptView({ environment: BROWSER_TAB, canPrompt: false })).toBe('hidden');
  });

  it('explains Add to Home Screen on iOS', () => {
    expect(
      installPromptView({ environment: { ...BROWSER_TAB, isIos: true }, canPrompt: false }),
    ).toBe('ios-hint');
  });

  it('shows nothing once installed', () => {
    expect(
      installPromptView({
        environment: { isIos: true, isInstalled: true, isDismissed: false },
        canPrompt: true,
      }),
    ).toBe('hidden');
  });

  it('shows nothing once dismissed', () => {
    expect(
      installPromptView({
        environment: { isIos: true, isInstalled: false, isDismissed: true },
        canPrompt: true,
      }),
    ).toBe('hidden');
  });
});
