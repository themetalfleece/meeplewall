import { closeDatabase, createDatabase, migrateDatabase } from '../src/index.ts';
import { requireDatabaseUrl } from '../src/dev/database-url.ts';

const database = createDatabase({ connectionString: requireDatabaseUrl() });
try {
  await migrateDatabase(database);
  console.log('Migrations applied');
} finally {
  await closeDatabase(database);
}
