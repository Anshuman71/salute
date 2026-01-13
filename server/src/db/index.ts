import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';

// Get database URL from environment, default to local file
const DATABASE_URL = process.env.DATABASE_URL || './game.db';

const sqlite = new Database(DATABASE_URL);
export const db = drizzle(sqlite, { schema });

// Run migrations on startup (creates tables from schema)
migrate(db, { migrationsFolder: './drizzle' });

export { schema };
