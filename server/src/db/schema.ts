import { sqliteTable, text, integer, AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

// Game rooms
export const rooms = sqliteTable('rooms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  hostIp: text('host_ip').notNull(),
  status: text('status', { enum: ['waiting', 'playing', 'finished'] }).notNull().default('waiting'),
  settings: text('settings').notNull(), // JSON string: {totalRounds, numPlayers}
  gameState: text('game_state'), // JSON string: Full GameState object for persistence
  currentRound: integer('current_round').notNull().default(0),
  winnerId: text('winner_id').references((): AnySQLiteColumn => roomPlayers.playerId),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn((): Date => new Date()),
});

// Players in rooms
export const roomPlayers = sqliteTable('room_players', {
  roomId: integer('room_id').notNull().references((): AnySQLiteColumn => rooms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  playerId: text('player_id').notNull().unique(), // Player identifier
  isHost: integer('is_host', { mode: 'boolean' }).notNull().default(false),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn((): Date => new Date()),
});

// Game round history
export const gameRounds = sqliteTable('game_rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roomId: integer('room_id').notNull().references((): AnySQLiteColumn => rooms.id, { onDelete: 'cascade' }),
  roundNumber: integer('round_number').notNull(),
  winnerId: text('winner_id').notNull().references((): AnySQLiteColumn => roomPlayers.playerId),
  scores: text('scores').notNull(), // JSON string: {playerName: score}
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn((): Date => new Date()),
});

// Rate limiting
export const rateLimits = sqliteTable('rate_limits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ip: text('ip').notNull(),
  action: text('action', { enum: ['create_room', 'join_room'] }).notNull(),
  count: integer('count').notNull().default(1),
  windowStart: integer('window_start', { mode: 'timestamp' }).notNull().$defaultFn((): Date => new Date()),
});

// Types
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Player = typeof roomPlayers.$inferSelect;
export type NewPlayer = typeof roomPlayers.$inferInsert;
export type RateLimit = typeof rateLimits.$inferSelect;
