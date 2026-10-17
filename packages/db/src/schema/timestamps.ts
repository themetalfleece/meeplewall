import { timestamp } from 'drizzle-orm/pg-core';

/** A required `timestamptz` column that defaults to the insert time. */
export function timestampDefaultNow(name: string) {
  return timestamp(name, { withTimezone: true }).notNull().defaultNow();
}

/** An optional `timestamptz` column. */
export function optionalTimestamp(name: string) {
  return timestamp(name, { withTimezone: true });
}
