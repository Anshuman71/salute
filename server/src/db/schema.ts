import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Game rooms
export const rooms = sqliteTable('rooms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  hostIp: text('host_ip').notNull(),
  status: text('status', { enum: ['waiting', 'playing', 'finished'] }).notNull().default('waiting'),
  settings: text('settings').notNull(), // JSON string: {totalRounds, numPlayers}
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Players in rooms
export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roomId: integer('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sessionId: text('session_id').notNull().unique(), // WebSocket session identifier
  isHost: integer('is_host', { mode: 'boolean' }).notNull().default(false),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Rate limiting
export const rateLimits = sqliteTable('rate_limits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ip: text('ip').notNull(),
  action: text('action', { enum: ['create_room', 'join_room'] }).notNull(),
  count: integer('count').notNull().default(1),
  windowStart: integer('window_start', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Types
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type RateLimit = typeof rateLimits.$inferSelect;
