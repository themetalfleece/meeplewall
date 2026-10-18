/** Structured JSON logs on stdout and stderr, one object per line, for the host to collect. */

type LogFields = Record<string, string | number | boolean | null>;

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

export function logInfo({ message, fields }: { message: string; fields?: LogFields }): void {
  console.log(
    JSON.stringify({ level: 'info', time: new Date().toISOString(), message, ...fields }),
  );
}

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
