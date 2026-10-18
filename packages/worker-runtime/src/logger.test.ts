import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { describeError, JsonLogger, LOG_LEVELS, type LogLevel } from './logger.ts';

const logEntrySchema = z.looseObject({
  time: z.iso.datetime(),
  level: z.enum(LOG_LEVELS),
  message: z.string(),
});

function captureLogger(level: LogLevel = 'info') {
  const lines: string[] = [];
  const logger = new JsonLogger({ write: (line) => lines.push(line), level });

  return { lines, logger };
}

function parseLine(line: string | undefined) {
  return logEntrySchema.parse(JSON.parse(line ?? ''));
}

describe('JsonLogger', () => {
  it('writes one JSON object per line with the level, message, time and fields', () => {
    const { lines, logger } = captureLogger();

    logger.info('Image job ready', { jobId: 7, kind: 'cover' });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.endsWith('\n')).toBe(true);
    expect(parseLine(lines[0])).toMatchObject({
      level: 'info',
      message: 'Image job ready',
      jobId: 7,
      kind: 'cover',
    });
  });

  it.each(['info', 'warn', 'error'] as const)('logs %s at its own level', (level) => {
    const { lines, logger } = captureLogger();

    logger[level]('Something happened');

    expect(parseLine(lines[0]).level).toBe(level);
  });

  it('never lets a field overwrite the level or message', () => {
    const { lines, logger } = captureLogger();

    logger.error('Real message', { level: 'info', message: 'Forged' });

    expect(parseLine(lines[0])).toMatchObject({ level: 'error', message: 'Real message' });
  });

  it('drops entries below its level', () => {
    const { lines, logger } = captureLogger('warn');

    logger.info('Claimed image job');
    logger.warn('Lost the lease');
    logger.error('Image job failed');

    expect(lines.map((line) => parseLine(line).level)).toEqual(['warn', 'error']);
  });

  it('logs only errors at the error level', () => {
    const { lines, logger } = captureLogger('error');

    logger.info('Claimed image job');
    logger.warn('Lost the lease');
    logger.error('Image job failed');

    expect(lines.map((line) => parseLine(line).level)).toEqual(['error']);
  });

  it('keeps a multi-line message on one line', () => {
    const { lines, logger } = captureLogger();

    logger.warn('first\nsecond');

    expect(lines[0]?.trimEnd().includes('\n')).toBe(false);
    expect(parseLine(lines[0]).message).toBe('first\nsecond');
  });
});

describe('describeError', () => {
  it('uses the message of an Error', () => {
    expect(describeError(new TypeError('fetch failed'))).toBe('fetch failed');
  });

  it('stringifies anything else that was thrown', () => {
    expect(describeError('plain string')).toBe('plain string');
    expect(describeError(42)).toBe('42');
    expect(describeError(undefined)).toBe('undefined');
  });
});
