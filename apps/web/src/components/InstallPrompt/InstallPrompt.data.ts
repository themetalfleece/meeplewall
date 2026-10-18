import { DISMISSED_STORAGE_KEY } from './InstallPrompt.constants';
import type { InstallEnvironment, InstallPromptView } from './InstallPrompt.types';

/** iPhones and iPads, including iPadOS, whose Safari reports a Mac user agent on a touch screen. */
export function isIosDevice({
  userAgent,
  platform,
  maxTouchPoints,
}: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return true;
  }

  return platform === 'MacIntel' && maxTouchPoints > 1;
}

/** The standard display mode, or the flag iOS sets on a home screen app. */
function isRunningInstalled(browserWindow: Window): boolean {
  if (browserWindow.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  const { navigator } = browserWindow;
  return 'standalone' in navigator && navigator.standalone === true;
}

/** Storage throws where the browser blocks it. Treat that as never dismissed. */
function wasDismissed(browserWindow: Window): boolean {
  try {
    return browserWindow.localStorage.getItem(DISMISSED_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function readInstallEnvironment(browserWindow: Window): InstallEnvironment {
  const { navigator } = browserWindow;

  return {
    isIos: isIosDevice({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    }),
    isInstalled: isRunningInstalled(browserWindow),
    isDismissed: wasDismissed(browserWindow),
  };
}

/** Remembers that the user closed the prompt. If storage is blocked it shows again next visit. */
export function rememberDismissal(browserWindow: Window): void {
  try {
    browserWindow.localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
  } catch {
    // The prompt is closed for this visit either way.
  }
}

/** Which prompt to show: none before mount, once installed, or once dismissed. */
export function installPromptView({
  environment,
  canPrompt,
}: {
  environment: InstallEnvironment | null;
  canPrompt: boolean;
}): InstallPromptView {
  if (environment === null || environment.isInstalled || environment.isDismissed) {
    return 'hidden';
  }

  if (canPrompt) {
    return 'install';
  }

  if (environment.isIos) {
    return 'ios-hint';
  }

  return 'hidden';
}
