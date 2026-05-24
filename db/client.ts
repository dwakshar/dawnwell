import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

const client = openDatabaseSync('dawnwell.db');

client.execSync('PRAGMA journal_mode=WAL;');
client.execSync('PRAGMA foreign_keys=ON;');

export const db = drizzle(client, { schema });

export type Database = typeof db;
