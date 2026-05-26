import type { SQLiteDatabase } from 'expo-sqlite';

type MigrationConfig = {
  journal: { entries: Array<{ idx: number; tag: string; breakpoints: boolean }> };
  migrations: Record<string, string>;
};

export async function runMigrations(db: SQLiteDatabase, config: MigrationConfig): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      hash TEXT NOT NULL,
      created_at INTEGER
    )
  `);

  const applied = await db.getAllAsync<{ hash: string }>(
    'SELECT hash FROM "__drizzle_migrations" ORDER BY id'
  );
  const appliedHashes = new Set(applied.map((r) => r.hash));

  for (const entry of config.journal.entries) {
    if (appliedHashes.has(entry.tag)) continue;

    const key = `m${String(entry.idx).padStart(4, '0')}`;
    const sql = config.migrations[key];
    if (typeof sql !== 'string' || !sql.trim()) continue;

    const statements = entry.breakpoints
      ? sql.split('--> statement-breakpoint')
      : [sql];

    for (const stmt of statements) {
      const cleaned = stmt.trim();
      if (cleaned) await db.execAsync(cleaned);
    }

    await db.runAsync(
      'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
      [entry.tag, Date.now()]
    );
  }
}
