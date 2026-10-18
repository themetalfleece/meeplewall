import { sql } from 'drizzle-orm';

/** The `locked_until` of a lease taken or renewed now for `holdSeconds`, on the database clock. */
export function leaseExpiry(holdSeconds: number) {
  return sql`now() + make_interval(secs => ${holdSeconds})`;
}
