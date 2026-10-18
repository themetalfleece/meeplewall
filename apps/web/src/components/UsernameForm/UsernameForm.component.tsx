'use client';

import { useUsernameForm } from './UsernameForm.hooks';
import styles from './UsernameForm.module.css';

/** Opens any BGG user's collection by name. */
export function UsernameForm() {
  const { value, error, handleChange, handleSubmit } = useUsernameForm();

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor="bgg-username">
        BoardGameGeek username
      </label>
      <div className={styles.row}>
        <input
          id="bgg-username"
          className={styles.input}
          value={value}
          onChange={handleChange}
          placeholder="themetalfleece"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error === null ? undefined : 'bgg-username-error'}
        />
        <button className={styles.button} type="submit">
          Open collection
        </button>
      </div>
      {error !== null && (
        <p id="bgg-username-error" className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
