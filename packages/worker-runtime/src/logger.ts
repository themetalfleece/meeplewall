/** Most verbose first: a logger at one level drops everything before it. */
export const LOG_LEVELS = ['info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogFields = Record<string, string | number | boolean | null>;

/** Writes one JSON object per line, for whatever collects the container's stdout. */
export class JsonLogger {
  readonly #write: (line: string) => void;
  readonly #lowestRank: number;

  /** Logs `level` and everything more severe. */
  constructor({ write, level }: { write: (line: string) => void; level: LogLevel }) {
    this.#write = write;
    this.#lowestRank = LOG_LEVELS.indexOf(level);
  }

  info(message: string, fields: LogFields = {}): void {
    this.#log({ level: 'info', message, fields });
  }

  warn(message: string, fields: LogFields = {}): void {
    this.#log({ level: 'warn', message, fields });
  }

  error(message: string, fields: LogFields = {}): void {
    this.#log({ level: 'error', message, fields });
  }

  #log({ level, message, fields }: { level: LogLevel; message: string; fields: LogFields }): void {
    if (LOG_LEVELS.indexOf(level) < this.#lowestRank) {
      return;
    }

    // The fixed keys come last so a field can never overwrite them.
    const entry = { ...fields, time: new Date().toISOString(), level, message };
    this.#write(`${JSON.stringify(entry)}\n`);
  }
}

/** A readable message for anything thrown. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
