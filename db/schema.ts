// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  payload: text('payload').notNull(),
  version: integer('version').notNull().default(0),
  expires: integer('expires').notNull(),
}, table => [index('idx_rooms_expires').on(table.expires)]);
