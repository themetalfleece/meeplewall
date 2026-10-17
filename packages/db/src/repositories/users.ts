import { eq, sql } from 'drizzle-orm';

import type { DatabaseExecutor } from '../database.ts';
import { bggUsers, type BggUser } from '../schema/index.ts';

function usernameMatches(username: string) {
  return eq(sql`lower(${bggUsers.bggUsername})`, username.toLowerCase());
}

/** Finds a user by BGG username, ignoring case. */
export async function findUser(
  database: DatabaseExecutor,
  { username }: { username: string },
): Promise<BggUser | undefined> {
  const [user] = await database.select().from(bggUsers).where(usernameMatches(username));

  return user;
}

/** Returns the user with this BGG username, creating it on first sight. */
export async function ensureUser(
  database: DatabaseExecutor,
  { username }: { username: string },
): Promise<BggUser> {
  await database.insert(bggUsers).values({ bggUsername: username }).onConflictDoNothing();

  const user = await findUser(database, { username });
  if (user === undefined) {
    throw new Error(`BGG user "${username}" was neither inserted nor found`);
  }

  return user;
}
