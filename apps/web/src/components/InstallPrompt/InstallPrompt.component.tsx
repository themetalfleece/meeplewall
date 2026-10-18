'use client';

import { useInstallPrompt } from './InstallPrompt.hooks';
import styles from './InstallPrompt.module.css';

/** Offers to install the app: the browser's prompt where there is one, a how-to on iOS. */
export function InstallPrompt() {
  const { view, install, dismiss } = useInstallPrompt();
  if (view === 'hidden') {
    return null;
  }

  return (
    <aside className={styles.prompt} aria-label="Install Meeplewall">
      {view === 'install' ? (
        <>
          <p className={styles.text}>
            Install Meeplewall to open collections from your home screen.
          </p>
          <button type="button" className={styles.install} onClick={install}>
            Install
          </button>
        </>
      ) : (
        <p className={styles.text}>To install Meeplewall, tap Share, then Add to Home Screen.</p>
      )}
      <button type="button" className={styles.dismiss} onClick={dismiss}>
        Not now
      </button>
    </aside>
  );
}
