import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { db } from './src/db';

console.log('Running migrations...');
migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations complete!');
