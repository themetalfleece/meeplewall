import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { downloadSource } from './download-source.ts';
import { holdResponse, StubServer } from './testing/stub-server.ts';

const PATH = '/images/cover.jpg';
const MAX_BYTES = 10;

describe('downloadSource', () => {
  let source: StubServer;

  function download({ timeoutMilliseconds = 2_000 }: { timeoutMilliseconds?: number } = {}) {
    return downloadSource({
      sourceUrl: source.url(PATH),
      timeoutMilliseconds,
      maxBytes: MAX_BYTES,
    });
  }

  beforeAll(async () => {
    source = await StubServer.start();
  });

  beforeEach(() => {
    source.reset();
  });

  afterAll(async () => {
    await source.close();
  });

  it('returns the body on 200', async () => {
    source.route({ path: PATH, response: { status: 200, body: 'tiny image' } });

    expect((await download()).toString('utf8')).toBe('tiny image');
  });

  it('accepts a body of exactly the cap', async () => {
    source.route({ path: PATH, response: { status: 200, body: 'x'.repeat(MAX_BYTES) } });

    expect((await download()).byteLength).toBe(MAX_BYTES);
  });

  it.each([404, 500])('throws with the status when the source answers %i', async (status) => {
    source.route({ path: PATH, response: { status } });

    await expect(download()).rejects.toThrow(`Source fetch failed with ${status}`);
  });

  it('refuses a declared length over the cap without reading the body', async () => {
    // The header promises far more than is sent. Reading the body would wait for bytes that never
    // come and fail on the timeout instead, so only the header check produces this message.
    source.route({
      path: PATH,
      response: { status: 200, body: 'short', headers: { 'content-length': '1000' } },
    });

    await expect(download({ timeoutMilliseconds: 1_000 })).rejects.toThrow(
      `Source is larger than ${MAX_BYTES} bytes`,
    );
  });

  it('refuses a chunked body over the cap', async () => {
    source.route({
      path: PATH,
      response: {
        status: 200,
        body: 'x'.repeat(MAX_BYTES + 1),
        headers: { 'transfer-encoding': 'chunked' },
      },
    });

    await expect(download()).rejects.toThrow(`Source is larger than ${MAX_BYTES} bytes`);
  });

  it('rejects a source slower than the timeout', async () => {
    const { waitFor, release } = holdResponse();
    source.route({ path: PATH, response: { status: 200, body: 'late', waitFor } });

    try {
      await expect(download({ timeoutMilliseconds: 100 })).rejects.toThrow(/timeout|aborted/i);
    } finally {
      release();
    }
  });

  it('rejects when the source is unreachable', async () => {
    const unreachable = await StubServer.start();
    const sourceUrl = unreachable.url(PATH);
    await unreachable.close();

    await expect(
      downloadSource({ sourceUrl, timeoutMilliseconds: 2_000, maxBytes: MAX_BYTES }),
    ).rejects.toThrow();
  });
});
