import { bigint, integer, pgTable, uuid } from 'drizzle-orm/pg-core';

import { bggUsers } from './bgg-users.ts';
import { refreshSource, refreshStatus } from './enums.ts';
import { timestampDefaultNow } from './timestamps.ts';

export const refreshLog = pgTable('refresh_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid('user_id')
    .notNull()
    .references(() => bggUsers.id, { onDelete: 'cascade' }),
  requestedAt: timestampDefaultNow('requested_at'),
  source: refreshSource('source').notNull(),
  durationMs: integer('duration_ms'),
  status: refreshStatus('status').notNull(),
});

export type RefreshLogEntry = typeof refreshLog.$inferSelect;
export type NewRefreshLogEntry = typeof refreshLog.$inferInsert;
