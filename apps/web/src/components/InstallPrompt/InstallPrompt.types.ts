/** Chrome's deferred install prompt. Not in the DOM typings, since only Chromium browsers fire it. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

/** What the browser says about installing, read once the page has mounted. */
export interface InstallEnvironment {
  /** iOS has no install prompt: the user adds the site from the Share menu instead. */
  isIos: boolean;
  /** Running as an installed app rather than in a browser tab. */
  isInstalled: boolean;
  /** The user closed the prompt on an earlier visit or this one. */
  isDismissed: boolean;
}

/** `install` offers the browser's prompt; `ios-hint` explains Add to Home Screen. */
export type InstallPromptView = 'hidden' | 'install' | 'ios-hint';
