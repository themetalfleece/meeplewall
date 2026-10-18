import { useEffect, useState } from 'react';

import { installPromptView, readInstallEnvironment, rememberDismissal } from './InstallPrompt.data';
import type { BeforeInstallPromptEvent, InstallEnvironment } from './InstallPrompt.types';

/**
 * The install prompt's state. Keeps Chrome's `beforeinstallprompt` event so the app shows its own
 * button, and reads the platform after mount so the server render and hydration agree.
 */
export function useInstallPrompt() {
  const [environment, setEnvironment] = useState<InstallEnvironment | null>(null);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setEnvironment(readInstallEnvironment(window));

    function handleBeforeInstallPrompt(event: BeforeInstallPromptEvent) {
      // Stops Chrome's own mini-infobar, so the app's prompt is the only one.
      event.preventDefault();
      setPromptEvent(event);
    }

    function handleAppInstalled() {
      setPromptEvent(null);
      setEnvironment((current) => updateEnvironment(current, { isInstalled: true }));
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  function install() {
    if (promptEvent === null) {
      return;
    }

    // An event prompts once, whatever the user chooses, so drop it before asking.
    setPromptEvent(null);
    void promptEvent.prompt();
  }

  function dismiss() {
    rememberDismissal(window);
    setEnvironment((current) => updateEnvironment(current, { isDismissed: true }));
  }

  return {
    view: installPromptView({ environment, canPrompt: promptEvent !== null }),
    install,
    dismiss,
  };
}

/** The environment with `change` applied, or null while the page has not mounted. */
function updateEnvironment(
  environment: InstallEnvironment | null,
  change: Partial<InstallEnvironment>,
): InstallEnvironment | null {
  if (environment === null) {
    return null;
  }

  return { ...environment, ...change };
}
