import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

// Get database URL from environment, default to local file
const DATABASE_URL = process.env.DATABASE_URL || './game.db';

const sqlite = new Database(DATABASE_URL);

sqlite.run('PRAGMA foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export { schema };
