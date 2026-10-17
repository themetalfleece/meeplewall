import {
  closeDatabase,
  createDatabase,
  enqueueImageJob,
  imageKind,
  upsertCollection,
  upsertGame,
} from '../src/index.ts';
import { requireDatabaseUrl } from '../src/dev/database-url.ts';
import { SEED_COLLECTION, SEED_GAMES, SEED_USERNAME } from '../src/dev/seed-data.ts';

// Idempotent: rerunning updates the same rows instead of duplicating them.
const database = createDatabase({ connectionString: requireDatabaseUrl() });
try {
  for (const game of SEED_GAMES) {
    await upsertGame(database, { game });
    for (const kind of imageKind.enumValues) {
      await enqueueImageJob(database, { bggGameId: game.id, kind });
    }
  }
  await upsertCollection(database, {
    username: SEED_USERNAME,
    source: 'geekdo',
    fetchedAt: new Date(),
    items: SEED_COLLECTION,
  });
  console.log(`Seeded ${SEED_GAMES.length} games and the collection of "${SEED_USERNAME}"`);
} finally {
  await closeDatabase(database);
}
