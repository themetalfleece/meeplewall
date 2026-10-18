import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logError, logInfo } from './logger';

beforeEach(() => {
  vi.stubEnv('LOG_LEVEL', 'info');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function loggedLine(spy: { mock: { calls: unknown[][] } }): unknown {
  const [line] = spy.mock.calls[0] ?? [];

  return JSON.parse(String(line));
}

describe('logInfo', () => {
  it('writes one JSON line to stdout with the fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logInfo({ message: 'sync started', fields: { username: 'alice' } });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(loggedLine(spy)).toMatchObject({
      level: 'info',
      message: 'sync started',
      username: 'alice',
    });
  });

  it.each(['warn', 'error'])('writes nothing when LOG_LEVEL is %s', (level) => {
    vi.stubEnv('LOG_LEVEL', level);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logInfo({ message: 'sync started' });

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('logError', () => {
  it('writes the error message and stack to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logError({ message: 'sync crashed', error: new Error('pool closed'), fields: { attempt: 2 } });

    expect(loggedLine(spy)).toMatchObject({ level: 'error', message: 'sync crashed', attempt: 2 });
    expect(JSON.stringify(loggedLine(spy))).toContain('pool closed');
  });

  it('writes even when LOG_LEVEL is error', () => {
    vi.stubEnv('LOG_LEVEL', 'error');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logError({ message: 'sync crashed', error: new Error('pool closed') });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('stringifies a thrown value that is not an Error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logError({ message: 'odd throw', error: 'just a string' });

    expect(loggedLine(spy)).toMatchObject({ error: 'just a string' });
  });

  it('keeps the error field when a caller passes one in fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logError({ message: 'clash', error: new Error('real'), fields: { error: 'fake' } });

    expect(JSON.stringify(loggedLine(spy))).toContain('real');
  });
});
