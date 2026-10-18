import { setTimeout as delay } from 'node:timers/promises';

import { connection } from 'next/server';

import { logError } from '@/lib/logger';
import { NO_STORE_HEADERS } from '@/lib/responses';
import { getDatabase } from '@/lib/services';

const DATABASE_TIMEOUT_MS = 2_000;

async function timeout(): Promise<never> {
  await delay(DATABASE_TIMEOUT_MS);
  throw new Error('Postgres did not answer in time');
}

/** 200 while the server runs and Postgres answers within two seconds, 503 otherwise. */
export async function GET(): Promise<Response> {
  await connection();

  try {
    await Promise.race([getDatabase().$client.query('select 1'), timeout()]);
  } catch (error) {
    logError({ message: 'Health check failed', error });
    return Response.json({ status: 'unavailable' }, { status: 503, headers: NO_STORE_HEADERS });
  }

  return Response.json({ status: 'ok' }, { headers: NO_STORE_HEADERS });
}
