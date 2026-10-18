import { setTimeout as delay } from 'node:timers/promises';

/** One round of work. Resolves true when it found work, so the next round starts at once. */
export type Poll = () => Promise<boolean>;

/**
 * Repeats a poll until stopped, waiting `idleMilliseconds` after a round that
 * found nothing. `stop` lets the round in hand finish and cuts the wait short.
 */
export class PollLoop {
  readonly #idleMilliseconds: number;
  readonly #stopping = new AbortController();

  constructor({ idleMilliseconds }: { idleMilliseconds: number }) {
    this.#idleMilliseconds = idleMilliseconds;
  }

  get isStopping(): boolean {
    return this.#stopping.signal.aborted;
  }

  /** Asks `run` to return once the round in hand, if any, is finished. */
  stop(): void {
    this.#stopping.abort();
  }

  /**
   * Polls until `stop` is called. Never rejects: a round that throws is passed
   * to `onError` and counts as finding nothing, so a database outage backs off.
   */
  async run({ poll, onError }: { poll: Poll; onError: (error: unknown) => void }): Promise<void> {
    while (!this.isStopping) {
      const foundWork = await poll().catch((error: unknown) => {
        onError(error);
        return false;
      });
      if (!foundWork) {
        await this.#idle();
      }
    }
  }

  async #idle(): Promise<void> {
    try {
      await delay(this.#idleMilliseconds, undefined, { signal: this.#stopping.signal });
    } catch (error) {
      if (!this.isStopping) {
        throw error;
      }
    }
  }
}
