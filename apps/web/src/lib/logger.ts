/** Structured JSON logs on stdout and stderr, one object per line, for the host to collect. */

import { logLevel } from './env';

type LogFields = Record<string, string | number | boolean | null>;

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

/** Written only when LOG_LEVEL is info. */
export function logInfo({ message, fields }: { message: string; fields?: LogFields }): void {
  if (logLevel() !== 'info') {
    return;
  }

  console.log(
    JSON.stringify({ level: 'info', time: new Date().toISOString(), message, ...fields }),
  );
}

/** Written at every LOG_LEVEL. */
export function logError({
  message,
  error,
  fields,
}: {
  message: string;
  error: unknown;
  fields?: LogFields;
}): void {
  console.error(
    JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      message,
      ...fields,
      error: describeError(error),
    }),
  );
}
